// Description:
//   Uses the Slack Real Time Messaging API to file GitHub issues
//
// Configuration:
//   HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH
//   HUBOT_GITHUB_TOKEN
//   HUBOT_SLACK_TOKEN

'use strict';

var path = require('path');
var slackGitHubIssues = require('../lib');

var configParams = {
  path: function() {
    return process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH ||
      path.join('config', 'slack-github-issues.json');
  },

  updates: function() {
    return {
      slackApiToken: process.env.HUBOT_SLACK_TOKEN,
      githubApiToken: process.env.HUBOT_GITHUB_TOKEN
    };
  }
};

function slackDataStore(robot) {
  // This may be undefined when running under test.
  if (robot.adapter.client) {
    return slackGitHubIssues.slackRtmDataStore(robot.adapter.client);
  }
}

function fileIssue(response) {
  // ReactionMessage (node_modules/hubot-slack/src/reaction-message.coffee) will
  // trim the 'reaction_' prefix from 'reaction_added'. The slack-github-issues
  // library requires we put it back.
  response.message.type = 'reaction_' + response.message.type;

  return this.execute(response.message)
    .then(function(issueUrl) {
      response.reply('created: ' + issueUrl);
      return issueUrl;
    })
    .catch(function(err) {
      if (err) {
        response.reply(err.message || err);
      }
      return Promise.reject(err);
    });
}

module.exports = function(robot) {
  var logger, config, reactionIssueFiler, listener;

  try {
    logger = slackGitHubIssues.logger(robot.logger);
    config = slackGitHubIssues.configFromFile(
      configParams.path(), logger, configParams.updates());
    reactionIssueFiler = slackGitHubIssues.slackBotReactionIssueFiler(
      config, slackDataStore(robot), logger);

    listener = fileIssue.bind(reactionIssueFiler);
    listener.impl = reactionIssueFiler;

    robot.react(listener);
    logger.info(null, 'listening for reaction_added events');

  } catch (err) {
    logger.error(null, 'reaction_added listener registration failed:',
      err instanceof Error ? err.message : err);
  }
};
