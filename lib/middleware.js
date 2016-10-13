'use strict';

var Rule = require('./rule');
var SlackClient = require('./slack-client');

module.exports = Middleware;

function Middleware(config, slackClient, githubClient, messageLock, logger) {
  this.rules = config.rules.map(function(rule) {
    return new Rule(rule);
  });
  this.successReaction = config.successReaction;
  this.slackClient = slackClient;
  this.githubClient = githubClient;
  this.messageLock = messageLock;
  this.logger = logger;
}

Middleware.prototype.execute = function(message) {
  var errorMessage;

  try {
    return doExecute.call(this, message);

  } catch (err) {
    errorMessage = 'unhandled error: ' +
      (err instanceof Error ? err.message : err) + '\nmessage: ' +
        JSON.stringify(message, null, 2);
    this.logger.error(null, errorMessage);
    return Promise.reject(errorMessage);
  }
};

function doExecute(message) {
  // TODO(mbland): Add Team ID to messageId
  var msgId = message.item.channel + ':' + message.item.ts,
      channelName = this.slackClient.getChannelName(message.item.channel)
        .catch(errHandler.bind(this, msgId, 'failed to get channel name')),
      teamDomain = this.slackClient.getTeamDomain()
        .catch(errHandler.bind(this, msgId, 'failed to get team domain name')),
      lockAcquired = this.messageLock.lock(msgId)
        .catch(errHandler.bind(this, msgId, 'failed to acquire lock')),
      processMessage;

  processMessage = function(msgId, message, values) {
    var channelName = values.shift(),
        teamDomain = values.shift(),
        lockAcquired = values.shift(),
        rule = this.findMatchingRule(message, channelName),
        permalink = 'https://' + teamDomain + '.slack.com/archives/' +
          channelName + '/p' + message.item.ts.replace('.', ''),
        finish = handleFinish.bind(this, msgId, permalink);

    if (!rule) {
      return lockAcquired ? finish(null) : Promise.reject(null);

    } else if (!lockAcquired) {
      this.logger.info(msgId, 'already in progress');
      return Promise.reject(null);
    }
    this.logger.info(msgId, 'matches rule:', rule.toLogString());

    return getReactions.call(this, msgId, permalink, message)
      .then(fileGitHubIssue.bind(this, msgId, channelName,
        rule.githubRepository))
      .then(addSuccessReaction.bind(this, msgId, message))
      .then(finish, finish);
  };

  return Promise.all([channelName, teamDomain, lockAcquired])
    .catch(releaseLockOnError.bind(this, msgId, lockAcquired))
    .then(processMessage.bind(this, msgId, message));
}

Middleware.prototype.findMatchingRule = function(message, channelName) {
  if (message && message.type === SlackClient.REACTION_ADDED &&
      message.item.type === 'message') {
    return this.rules.find(function(rule) {
      return rule.match(message, channelName);
    });
  }
};

Middleware.prototype.parseMetadata = function(message, channelName) {
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
  throw err;
}

function releaseLockOnError(msgId, lockAcquired, err) {
  var releaseLockIfAcquired = function(acquired) {
    if (acquired) {
      return this.messageLock.unlock(msgId)
        .catch(errHandler.bind(this, msgId, 'failed to release lock'));
    }
  };
  return lockAcquired.then(releaseLockIfAcquired.bind(this)).then(function() {
    throw err;
  });
}

function getReactions(msgId, permalink, message) {
  var timestamp = message.item.ts;

  this.logger.info(msgId, 'getting reactions for', permalink);
  return this.slackClient.getReactions(message.item.channel, timestamp)
    .catch(errHandler.bind(this, msgId, 'failed to get reactions for ' +
      permalink));
}

function fileGitHubIssue(msgId, channelName, githubRepository, message) {
  var metadata,
      permalink = message.message.permalink;

  if (alreadyProcessed(message, this.successReaction)) {
    this.logger.info(msgId, 'already processed:', permalink);
    return Promise.reject(null);
  }

  metadata = this.parseMetadata(message, channelName);
  this.logger.info(msgId, 'making GitHub request for', permalink);

  return this.githubClient.fileNewIssue(metadata, githubRepository)
    .catch(errHandler.bind(this, msgId, 'failed to create a GitHub issue ' +
        'in ' + this.githubClient.user + '/' + githubRepository));
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
        return Promise.resolve(issueUrl);
      };

  this.logger.info(msgId, 'adding', reaction);
  return this.slackClient.addSuccessReaction(channel, timestamp)
    .then(onSuccess.bind(this))
    .catch(errHandler.bind(this, msgId, 'created ' + issueUrl +
      ' but failed to add ' + reaction));
}

function handleFinish(messageId, permalink, result) {
  return this.messageLock.unlock(messageId)
    .catch(errHandler.bind(this, messageId,
      'failed to release lock for ' + permalink))
    .then(function() {
      if (result instanceof Error) {
        throw result;
      }
      return result ? Promise.resolve(result) : Promise.reject(result);
    });
}
