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
  var messageId, channel, team;

  try {
    messageId = this.slackClient.messageId(message);
    channel = this.slackClient.channelInfo(message.item.channel)
      .catch(errHandler.bind(this, messageId, 'failed to get channel info')),
    team = this.slackClient.teamInfo()
      .catch(errHandler.bind(this, messageId, 'failed to get team info'));
    return Promise.all([channel, team])
      .then(processIfMatchesRule.bind(this, messageId, message));

  } catch (err) {
    err.message += ': message: ' + JSON.stringify(message, null, 0);
    this.logger.error(messageId, err.message);
    return Promise.reject(err);
  }
};

function processIfMatchesRule(msgId, message, values) {
  var channel = values.shift(),
      team = values.shift(),
      rule = this.findMatchingRule(message, channel.name);

  if (!rule) {
    return Promise.reject(null);
  }
  return this.messageLock.lock(msgId)
    .catch(errHandler.bind(this, msgId, 'failed to acquire lock'))
    .then(processMessage.bind(this, msgId, message, team, channel, rule));
}

function processMessage(msgId, message, team, channel, rule, lockAcquired) {
  var finish;

  if (!lockAcquired) {
    this.logger.info(msgId, 'already in progress');
    return Promise.reject(null);
  }
  this.logger.info(msgId, 'processing:',
    this.slackClient.permalink(team, channel, message));
  this.logger.info(msgId, 'matches rule:', rule.toLogString());
  finish = handleFinish.bind(this, msgId);

  return getReactions.call(this, msgId, message)
    .then(fileIssue.bind(this, msgId, channel, rule))
    .then(addSuccessReaction.bind(this, msgId, message))
    .then(finish, finish);
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

function fileIssue(msgId, channel, rule, message) {
  var metadata;

  if (alreadyProcessed(message, this.successReaction)) {
    this.logger.info(msgId, 'already processed');
    return Promise.reject(null);
  }

  metadata = this.parseMetadata(message, channel.name);
  this.logger.info(msgId, 'filing GitHub issue in ' +
    this.githubClient.user + '/' + rule.githubRepository);

  return this.githubClient.fileNewIssue(metadata, rule.githubRepository)
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

function handleFinish(messageId, result) {
  return this.messageLock.unlock(messageId)
    .catch(errHandler.bind(this, messageId, 'failed to release lock'))
    .then(function() {
      if (!result || result instanceof Error) {
        return Promise.reject(result);
      }
      return result;
    });
}
