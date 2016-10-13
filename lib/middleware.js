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
    return doExecute(this, message);

  } catch (err) {
    errorMessage = 'unhandled error: ' +
      (err instanceof Error ? err.message : err) + '\nmessage: ' +
        JSON.stringify(message, null, 2);
    this.logger.error(null, errorMessage);
    return Promise.reject(errorMessage);
  }
};

function doExecute(middleware, message) {
  var msgId = messageId(message),
      lookups = [
        getChannelName(middleware, msgId, message),
        getTeamDomain(middleware, msgId),
        acquireLock(middleware, msgId)
      ];

  return Promise.all(lookups).then(function(values) {
    var channelName = values.shift(),
        teamDomain = values.shift(),
        lockAcquired = values.shift(),
        rule = middleware.findMatchingRule(message, channelName),
        permalink = makePermalink(teamDomain, channelName, message),
        finish = handleFinish(msgId, permalink, middleware);

    if (!rule) {
      return lockAcquired ? finish(null) : Promise.reject(null);

    } else if (!lockAcquired) {
      middleware.logger.info(msgId, 'already in progress');
      return Promise.reject(null);
    }
    middleware.logger.info(msgId, 'matches rule:', rule.toLogString());

    return getReactions(middleware, msgId, permalink, message)
      .then(fileGitHubIssue(middleware, msgId, channelName,
        rule.githubRepository))
      .then(addSuccessReaction(middleware, msgId, message))
      .then(finish, finish);
  });
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

// TODO: Add Team ID to messageId
function messageId(message) {
  return message.item.channel + ':' + message.item.ts;
}

function errHandler(middleware, msgId, label) {
  return function(err) {
    err.message = label + ': ' + err.message;
    middleware.logger.error(msgId, err.message);
    throw err;
  };
}

function getChannelName(middleware, msgId, message) {
  return middleware.slackClient.getChannelName(message.item.channel)
    .catch(errHandler(middleware, msgId, 'failed to get channel name'));
}

function getTeamDomain(middleware, msgId) {
  return middleware.slackClient.getTeamDomain()
    .catch(errHandler(middleware, msgId, 'failed to get team domain name'));
}

function acquireLock(middleware, msgId) {
  return middleware.messageLock.lock(msgId)
    .catch(errHandler(middleware, msgId, 'failed to acquire lock'));
}

function makePermalink(teamDomain, channelName, message) {
  return 'https://' + teamDomain + '.slack.com/archives/' +
    channelName + '/p' + message.item.ts.replace('.', '');
}

function getReactions(middleware, msgId, permalink, message) {
  var timestamp = message.item.ts;

  middleware.logger.info(msgId, 'getting reactions for', permalink);
  return middleware.slackClient.getReactions(message.item.channel, timestamp)
    .catch(errHandler(middleware, msgId, 'failed to get reactions for ' +
      permalink));
}

function fileGitHubIssue(middleware, msgId, channelName, githubRepository) {
  return function(message) {
    var metadata,
        permalink = message.message.permalink;

    if (alreadyProcessed(message, middleware.successReaction)) {
      middleware.logger.info(msgId, 'already processed:', permalink);
      return Promise.reject(null);
    }

    metadata = middleware.parseMetadata(message, channelName);
    middleware.logger.info(msgId, 'making GitHub request for', permalink);

    return middleware.githubClient.fileNewIssue(metadata, githubRepository)
      .catch(errHandler(middleware, msgId, 'failed to create a GitHub issue ' +
          'in ' + middleware.githubClient.user + '/' + githubRepository));
  };
}

function alreadyProcessed(message, successReaction) {
  return message.message.reactions.find(function(reaction) {
    return reaction.name === successReaction;
  });
}

function addSuccessReaction(middleware, msgId, message) {
  return function(issueUrl) {
    var channel = message.item.channel,
        timestamp = message.item.ts,
        reaction = middleware.slackClient.successReaction;

    middleware.logger.info(msgId, 'adding', reaction);
    return middleware.slackClient.addSuccessReaction(channel, timestamp)
      .then(function() {
        middleware.logger.info(msgId, 'created: ' + issueUrl);
        return Promise.resolve(issueUrl);
      })
      .catch(errHandler(middleware, msgId, 'created ' + issueUrl +
        ' but failed to add ' + reaction));
  };
}

function handleFinish(messageId, permalink, middleware) {
  return function(result) {
    return middleware.messageLock.unlock(messageId)
      .catch(errHandler(middleware, messageId,
        'failed to release lock for ' + permalink))
      .then(function() {
        if (result instanceof Error) {
          throw result;
        }
        return result ? Promise.resolve(result) : Promise.reject(result);
      });
  };
}
