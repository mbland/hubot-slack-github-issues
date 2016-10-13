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
      channelName,
      rule,
      permalink;

  return getChannelName(middleware, message)
    .then(function(result) {
      channelName = result;
      rule = middleware.findMatchingRule(message, channelName);

      if (!rule) {
        return Promise.reject(null);
      }
      return getTeamDomain(middleware);
    })
    .then(function(teamDomain) {
      permalink = makePermalink(teamDomain, channelName, message);
      return acquireLock(middleware, msgId);
    })
    .then(function(lockAcquired) {
      var finish;

      if (!lockAcquired) {
        middleware.logger.info(msgId, 'already in progress');
        return Promise.reject(null);
      }
      middleware.logger.info(msgId, 'matches rule:', rule.toLogString());
      finish = handleFinish(msgId, permalink, middleware);

      return getReactions(middleware, msgId, permalink, message)
        .then(fileGitHubIssue(middleware, msgId, channelName,
          rule.githubRepository))
        .then(addSuccessReaction(middleware, msgId, message))
        .then(handleSuccess(finish), handleFailure(finish));
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

function getChannelName(middleware, message) {
  return middleware.slackClient.getChannelName(message.item.channel);
}

function getTeamDomain(middleware) {
  return middleware.slackClient.getTeamDomain();
}

function acquireLock(middleware, msgId) {
  return middleware.messageLock.lock(msgId);
}

function makePermalink(teamDomain, channelName, message) {
  return 'https://' + teamDomain + '.slack.com/archives/' +
    channelName + '/p' + message.item.ts.replace('.', '');
}

function getReactions(middleware, msgId, permalink, message) {
  var timestamp = message.item.ts,
      reject;

  reject = function(err) {
    return Promise.reject(new Error('failed to get reactions for ' +
      permalink + ': ' + err.message));
  };

  middleware.logger.info(msgId, 'getting reactions for', permalink);
  return middleware.slackClient.getReactions(message.item.channel, timestamp)
    .catch(reject);
}

function fileGitHubIssue(middleware, msgId, channelName, githubRepository) {
  return function(message) {
    var metadata,
        permalink = message.message.permalink,
        reject;

    if (alreadyProcessed(message, middleware.successReaction)) {
      middleware.logger.info(msgId, 'already processed:', permalink);
      return Promise.reject(null);
    }

    metadata = middleware.parseMetadata(message, channelName);
    middleware.logger.info(msgId, 'making GitHub request for', permalink);

    reject = function(err) {
      return Promise.reject(new Error('failed to create a GitHub issue in ' +
        middleware.githubClient.user + '/' + githubRepository + ': ' +
        err.message));
    };
    return middleware.githubClient.fileNewIssue(metadata, githubRepository)
      .catch(reject);
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
        reaction = middleware.slackClient.successReaction,
        resolve, reject;

    resolve = function() {
      return Promise.resolve(issueUrl);
    };

    reject = function(err) {
      return Promise.reject(new Error('created ' + issueUrl +
        ' but failed to add ' + reaction + ': ' + err.message));
    };

    middleware.logger.info(msgId, 'adding', reaction);
    return middleware.slackClient.addSuccessReaction(channel, timestamp)
      .then(resolve, reject);
  };
}

function handleSuccess(finish) {
  return function(issueUrl) {
    return finish('created: ' + issueUrl).then(function() {
      return Promise.resolve(issueUrl);
    });
  };
}

function handleFailure(finish) {
  return function(err) {
    return finish(err).then(function() {
      return Promise.reject(err);
    });
  };
}

function handleFinish(messageId, permalink, middleware) {
  return function(message) {
    if (message instanceof Error) {
      middleware.logger.error(messageId, message.message);
    } else {
      middleware.logger.info(messageId, message);
    }
    return middleware.messageLock.unlock(messageId)
      .catch(function(err) {
        middleware.logger.error(messageId, 'failed to release lock for ' +
          permalink + ': ' + err.message);
      });
  };
}
