'use strict';

var Rule = require('./rule');
var constants = require('./constants');

module.exports = ReactionIssueFiler;

function ReactionIssueFiler(config, slackClient, githubClient, messageLock,
  logger) {
  this.rules = config.rules.map(function(rule) {
    return new Rule(rule);
  });
  this.slackClient = slackClient;
  this.githubClient = githubClient;
  this.messageLock = messageLock;
  this.logger = logger;
}

ReactionIssueFiler.prototype.findMatchingRule = function(message, channelName) {
  return findMatchingRule(this.rules, message, channelName);
};

ReactionIssueFiler.prototype.parseMetadata = function(getReactionsResponse,
  channelInfo) {
  return parseMetadata(getReactionsResponse, channelInfo);
};

ReactionIssueFiler.prototype.execute = function(message) {
  var filer = this;
  return new Promise(function(resolve, reject) {
    var messageId, impl;
    try {
      messageId = filer.slackClient.messageId(message);
      impl = new Impl(filer, message, messageId);
      impl.execute(resolve, reject);
    } catch (err) {
      err.message += ': message: ' + JSON.stringify(message, null, 0);
      filer.logger.error(messageId, err.message);
      reject(err);
    }
  });
};

function Impl(filer, message, messageId) {
  this.rules = filer.rules;
  this.slackClient = filer.slackClient;
  this.githubClient = filer.githubClient;
  this.messageLock = filer.messageLock;
  this.logger = filer.logger;
  this.successReaction = filer.slackClient.successReaction;
  this.message = message;
  this.msgId = messageId;
  this.channel = null;
  this.team = null;
  this.rule = null;
}

Impl.prototype.execute = function(resolve, reject) {
  var impl = this,
      channel = this.slackClient.channelInfo(this.message.item.channel)
        .catch(this.abort('failed to get channel info')),
      team = this.slackClient.teamInfo()
        .catch(this.abort('failed to get team info')),
      finish = function(result) {
        (!result || result instanceof Error) ? reject(result) : resolve(result);
      };

  Promise.all([channel, team])
    .then(function(values) {
      return impl.processMessage(values[0], values[1]);
    })
    .then(finish, finish);
};

Impl.prototype.abort = function(label) {
  var impl = this;
  return function(err) {
    err.message = label + ': ' + err.message;
    impl.logger.error(impl.msgId, err.message);
    throw err;
  };
};

Impl.prototype.processMessage = function(channel, team) {
  var impl = this;

  this.channel = channel,
  this.team = team,
  this.rule = findMatchingRule(this.rules, this.message, this.channel.name);

  if (!this.rule) {
    return null;
  }
  return this.messageLock.lock(this.msgId)
    .catch(this.abort('failed to acquire lock'))
    .then(function(lockAcquired) {
      return impl.fileIssueIfNoSuccessReaction(lockAcquired);
    });
};

function findMatchingRule(rules, message, channelName) {
  if (message && message.type === constants.REACTION_ADDED &&
      message.item.type === 'message') {
    return rules.find(function(rule) {
      return rule.match(message, channelName);
    });
  }
}

Impl.prototype.fileIssueIfNoSuccessReaction = function(lockAcquired) {
  var impl = this,
      finish;

  if (!lockAcquired) {
    this.logger.info(this.msgId, 'already in progress');
    return null;
  }
  this.logger.info(this.msgId, 'processing:',
    this.slackClient.permalink(this.team, this.channel, this.message));
  this.logger.info(this.msgId, 'matches rule:', this.rule.toLogString());
  finish = function(result) {
    return impl.releaseLock(result);
  };

  return this.getReactions()
    .then(function(response) {
      return impl.fileIssue(response);
    })
    .then(function(issueUrl) {
      return impl.addSuccessReaction(issueUrl);
    })
    .then(finish, finish);
};

Impl.prototype.releaseLock = function(result) {
  return this.messageLock.unlock(this.msgId)
    .catch(this.abort('failed to release lock'))
    .then(function() {
      return result;
    });
};

Impl.prototype.getReactions = function() {
  var channelId = this.message.item.channel,
      timestamp = this.message.item.ts;

  this.logger.info(this.msgId, 'getting reactions');
  return this.slackClient.getReactions(channelId, timestamp)
    .catch(this.abort('failed to get reactions'));
};

Impl.prototype.fileIssue = function(getReactionsResponse) {
  var metadata,
      githubRepository = this.rule.githubRepository;

  if (this.alreadyProcessed(getReactionsResponse)) {
    this.logger.info(this.msgId, 'already processed');
    return Promise.reject(null);
  }

  metadata = parseMetadata(getReactionsResponse, this.channel);
  this.logger.info(this.msgId, 'filing GitHub issue in ' +
    this.githubClient.user + '/' + githubRepository);

  return this.githubClient.fileNewIssue(metadata, githubRepository)
    .catch(this.abort('failed to create a GitHub issue'));
};

Impl.prototype.alreadyProcessed = function(getReactionsResponse) {
  var impl = this;
  return getReactionsResponse.message.reactions.find(function(reaction) {
    return reaction.name === impl.successReaction;
  });
};

function parseMetadata(getReactionsResponse, channelInfo) {
  var metadata = {
    channel: channelInfo.name,
    timestamp: getReactionsResponse.message.ts,
    url: getReactionsResponse.message.permalink
  };
  metadata.date = new Date(metadata.timestamp * 1000);
  metadata.title = 'Update from #' + metadata.channel +
    ' at ' + metadata.date.toUTCString();
  return metadata;
}

Impl.prototype.addSuccessReaction = function(issueUrl) {
  var impl = this;
  this.logger.info(this.msgId, 'adding', this.successReaction);

  return this.slackClient.addSuccessReaction(
      this.message.item.channel, this.message.item.ts)
    .catch(this.abort('created ' + issueUrl + ' but failed to add ' +
      this.successReaction))
    .then(function() {
      impl.logger.info(impl.msgId, 'created: ' + issueUrl);
      return issueUrl;
    });
};
