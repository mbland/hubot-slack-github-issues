// Description:
//   Uses the Slack Real Time Messaging API to file GitHub issues
//
// Configuration:
//   HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH
//   HUBOT_GITHUB_TOKEN
//   HUBOT_SLACK_TOKEN

'use strict';

var path = require('path');
var Config = require('../lib/config');
var SlackRtmDataStore = require('../lib/slack-rtm-data-store');
var SlackClient = require('../lib/slack-client');
var GitHubClient = require('../lib/github-client');
var MessageLock = require('../lib/message-lock');
var Logger = require('../lib/logger');
var ReactionIssueFiler = require('../lib/reaction-issue-filer');

function parseConfigFromEnvironmentVariablePathOrUseDefault(logger) {
  var configPath = (
        process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH ||
        path.join('config', 'slack-github-issues.json')
      ),
      config = Config.parseConfigFile(configPath, logger);

  if (process.env.HUBOT_GITHUB_TOKEN) {
    config.githubApiToken = process.env.HUBOT_GITHUB_TOKEN;
  }
  if (process.env.HUBOT_SLACK_TOKEN) {
    config.slackApiToken = process.env.HUBOT_SLACK_TOKEN;
  }
  return config;
}

module.exports = function(robot) {
  var logger, config, slackDataStore, impl, fileIssue;

  // This will be undefined when running under test.
  if (robot.adapter.client) {
    slackDataStore = new SlackRtmDataStore(robot.adapter.client.rtm);
  }

  try {
    logger = new Logger(robot.logger);
    config = new Config(
      parseConfigFromEnvironmentVariablePathOrUseDefault(logger));
    impl = new ReactionIssueFiler(
      config,
      new SlackClient(slackDataStore, config),
      new GitHubClient(config),
      new MessageLock,
      logger);

    fileIssue = function(response) {
      return impl.execute(response.message)
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
    };
    fileIssue.impl = impl;

    robot.react(fileIssue);
    logger.info(null, 'listening for reaction_added events');

  } catch (err) {
    logger.error(null, 'reaction_added listener registration failed:',
      err instanceof Error ? err.message : err);
  }
};
