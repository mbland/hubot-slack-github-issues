// Description:
//   Uses the Slack Real Time Messaging API to file GitHub issues
//
// Configuration:
//   HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH

'use strict';

var Config = require('../lib/config');
var SlackClient = require('../lib/slack-client');
var GitHubClient = require('../lib/github-client');
var Logger = require('../lib/logger');
var Middleware = require('../lib/middleware');

// TODO(mbland): Remove this and switch to `robot.react` once a hubot-slack
// release containing slackhq/hubot-slack#363 is available (after v4.10.0).
var ReactionMessage = require('hubot-slack/src/reaction-message');

function matchReaction(message) {
  return message instanceof ReactionMessage;
}

module.exports = function(robot) {
  var logger, config, slackClient, impl, fileIssue;

  // This will be undefined when running under test.
  if (robot.adapter.client) {
    slackClient = robot.adapter.client.rtm;
  }

  try {
    logger = new Logger(robot.logger);
    config = new Config(null, logger);
    impl = new Middleware(
      config,
      new SlackClient(slackClient, config),
      new GitHubClient(config),
      logger);

    fileIssue = function(response) {
      return impl.execute(response.message, function(message) {
        response.reply(message);
      });
    };
    fileIssue.impl = impl;

    robot.listen(matchReaction, fileIssue);
    logger.info(null, 'listening for reaction_added events');

  } catch (err) {
    logger.error(null, 'reaction_added listener registration failed:',
      err instanceof Error ? err.message : err);
  }
};
