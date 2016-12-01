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

function configParams() {
  var params = {updates: {}};

  params.path = process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH ||
    path.join('config', 'slack-github-issues.json');

  params.updates.slackApiToken = process.env.HUBOT_SLACK_TOKEN;
  params.updates.githubApiToken = process.env.HUBOT_GITHUB_TOKEN;

  return params;
}

function slackDataStore(robot) {
  // This may be undefined when running under test.
  if (robot.adapter.client) {
    return slackGitHubIssues.slackRtmDataStore(robot.adapter.client);
  }
}

function fileIssue(filer, response) {
  // ReactionMessage (node_modules/hubot-slack/src/reaction-message.coffee) will
  // trim the 'reaction_' prefix from 'reaction_added'. The slack-github-issues
  // library requires we put it back.
  response.message.type = 'reaction_' + response.message.type;

  return filer.execute(response.message)
    .then(function(issueUrl) {
      response.reply('created: ' + issueUrl);
      return issueUrl;
    })
    .catch(function(err) {
      var result = err;

      if (err) {
        result = err.message || err;
        response.reply(result);
      }
      return result;
    });
}

module.exports = function(robot) {
  var logger = robot.logger,
      filer,
      listener = function(response) {
        return fileIssue(filer, response);
      };

  try {
    logger = slackGitHubIssues.logger(logger);
    filer = slackGitHubIssues.singleInstanceReactionIssueFiler(
      configParams(), slackDataStore(robot), logger);
    listener.impl = filer;

    robot.react(listener);
    logger.info(null, 'listening for reaction_added events');

  } catch (err) {
    logger.error(null, 'reaction_added listener registration failed:',
      err instanceof Error ? err.message : err);
  }
};
