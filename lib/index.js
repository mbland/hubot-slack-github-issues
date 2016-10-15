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

  config: function(configData, updates) {
    return new Config(configData, updates);
  },

  configFromFile: function(path, logger, updates) {
    return Config.fromFile(path, logger, updates);
  },

  slackRtmDataStore: function(slackClient) {
    return new SlackRtmDataStore(slackClient.rtm);
  },

  reactionIssueFiler: function(config, slackDataStore, messageLock, logger) {
    return new ReactionIssueFiler(
      config,
      new SlackClient(slackDataStore, config),
      new GitHubClient(config),
      messageLock,
      logger);
  },

  slackBotReactionIssueFiler: function(config, slackDataStore, logger) {
    return exports.reactionIssueFiler(
      config, slackDataStore, new MessageLock, logger);
  }
};
