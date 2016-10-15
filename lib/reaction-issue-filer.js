'use strict';

var Rule = require('./rule');
var SlackClient = require('./slack-client');

module.exports = ReactionIssueFiler;

function ReactionIssueFiler(config, slackClient, githubClient, messageLock,
  logger) {
  this.rules = config.rules.map(function(rule) {
    return new Rule(rule);
  });
  this.successReaction = config.successReaction;
  this.slackClient = slackClient;
  this.githubClient = githubClient;
  this.messageLock = messageLock;
  this.logger = logger;
}

ReactionIssueFiler.prototype.execute = function(message) {
  var messageId = null;

  try {
    messageId = this.slackClient.messageId(message);
    return doExecute.call(this, messageId, message);

  } catch (err) {
    err.message += ': message: ' + JSON.stringify(message, null, 0);
    this.logger.error(messageId, err.message);
    return Promise.reject(err);
  }
};

function doExecute(msgId, message) {
  var channel = this.slackClient.channelInfo(message.item.channel)
        .catch(errHandler.bind(this, msgId, 'failed to get channel info')),
      team = this.slackClient.teamInfo()
        .catch(errHandler.bind(this, msgId, 'failed to get team info')),
      lock = this.messageLock.lock(msgId)
        .catch(errHandler.bind(this, msgId, 'failed to acquire lock')),
      finish = handleFinish.bind(this, msgId, lock);

  return Promise.all([channel, team, lock])
    .then(processMessage.bind(this, msgId, message))
    .then(finish, finish);
}

function processMessage(msgId, message, values) {
  var channel = values.shift(),
      team = values.shift(),
      lockAcquired = values.shift(),
      rule = this.findMatchingRule(message, channel.name);

  if (!rule) {
    return Promise.reject(null);

  } else if (!lockAcquired) {
    this.logger.info(msgId, 'already in progress');
    return Promise.reject(null);
  }
  this.logger.info(msgId, 'processing:',
    this.slackClient.permalink(team, channel, message));
  this.logger.info(msgId, 'matches rule:', rule.toLogString());

  return getReactions.call(this, msgId, message)
    .then(fileGitHubIssue.bind(this, msgId, channel.name,
      rule.githubRepository))
    .then(addSuccessReaction.bind(this, msgId, message));
}

ReactionIssueFiler.prototype.findMatchingRule = function(message, channelName) {
  if (message && message.type === SlackClient.REACTION_ADDED &&
      message.item.type === 'message') {
    return this.rules.find(function(rule) {
      return rule.match(message, channelName);
    });
  }
};

ReactionIssueFiler.prototype.parseMetadata = function(message, channelName) {
  var result = {
    channel: channelName,
    timestamp: message.message.ts,
    url: message.message.permalink
  };
  result.date = new Date(result.timestamp * 1000);
  result.title = 'Update from #' + result.channel +
    ' at ' + result.date.toUTCString();
  return result;
};

function errHandler(msgId, label, err) {
  err.message = label + ': ' + err.message;
  this.logger.error(msgId, err.message);
  return Promise.reject(err);
}

function getReactions(msgId, message) {
  var timestamp = message.item.ts;

  this.logger.info(msgId, 'getting reactions');
  return this.slackClient.getReactions(message.item.channel, timestamp)
    .catch(errHandler.bind(this, msgId, 'failed to get reactions'));
}

function fileGitHubIssue(msgId, channelName, githubRepository, message) {
  var metadata;

  if (alreadyProcessed(message, this.successReaction)) {
    this.logger.info(msgId, 'already processed');
    return Promise.reject(null);
  }

  metadata = this.parseMetadata(message, channelName);
  this.logger.info(msgId, 'filing GitHub issue in ' +
    this.githubClient.user + '/' + githubRepository);

  return this.githubClient.fileNewIssue(metadata, githubRepository)
    .catch(errHandler.bind(this, msgId, 'failed to create a GitHub issue'));
}

function alreadyProcessed(message, successReaction) {
  return message.message.reactions.find(function(reaction) {
    return reaction.name === successReaction;
  });
}

function addSuccessReaction(msgId, message, issueUrl) {
  var channel = message.item.channel,
      timestamp = message.item.ts,
      reaction = this.slackClient.successReaction,
      onSuccess = function() {
        this.logger.info(msgId, 'created: ' + issueUrl);
        return issueUrl;
      };

  this.logger.info(msgId, 'adding', reaction);
  return this.slackClient.addSuccessReaction(channel, timestamp)
    .then(onSuccess.bind(this))
    .catch(errHandler.bind(this, msgId, 'created ' + issueUrl +
      ' but failed to add ' + reaction));
}

function releaseLock(messageId, acquired) {
  if (acquired) {
    return this.messageLock.unlock(messageId)
      .catch(errHandler.bind(this, messageId, 'failed to release lock'));
  }
}

function handleFinish(messageId, lock, result) {
  return lock.then(releaseLock.bind(this, messageId)).then(function() {
    if (!result || result instanceof Error) {
      return Promise.reject(result);
    }
    return result;
  });
}
