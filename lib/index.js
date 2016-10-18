'use strict';

var Config = require('./config');
var SlackRtmDataStore = require('./slack-rtm-data-store');
var SlackClient = require('./slack-client');
var GitHubClient = require('./github-client');
var MessageLock = require('./message-lock');
var Logger = require('./logger');
var ReactionIssueFiler = require('./reaction-issue-filer');

module.exports = exports = {
  logger: function(underlyingLogger) {
    return new Logger(underlyingLogger);
  },

  slackRtmDataStore: function(slackClient) {
    return new SlackRtmDataStore(slackClient.rtm);
  },

  singleInstanceReactionIssueFiler: function(configParams, slackDataStore,
      logger) {
    return exports.reactionIssueFiler(
      configParams, slackDataStore, new MessageLock, logger);
  },

  reactionIssueFiler: function(configParams, slackDataStore, messageLock,
      logger) {
    var filerConfig;

    if (!configParams.path && !configParams.data) {
      throw new Error('configParams must contain either "path" or "data"');
    } else if (configParams.path && configParams.data) {
      throw new Error('configParams contains both "path" and "data"');
    }

    if (configParams.path) {
      filerConfig = Config.fromFile(configParams.path, logger,
        configParams.updates);
    } else {
      filerConfig = new Config(configParams.data, configParams.updates);
    }

    return new ReactionIssueFiler(
      filerConfig,
      new SlackClient(slackDataStore, filerConfig),
      new GitHubClient(filerConfig),
      messageLock,
      logger);
  },

  loadHubotScript: function(robot) {
    var logger = new Logger(robot.logger),
        path = require('path'),
        scriptDir = path.resolve(__dirname, '..', 'scripts');

    logger.info(null, 'loading');
    robot.loadFile(scriptDir, 'slack-github-issues.js');
  }
};
