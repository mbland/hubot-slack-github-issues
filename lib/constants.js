'use strict';

var scriptName = require('../package.json').name;
var loggerPrefix = scriptName + ':';

module.exports = {
  LOGGER_PREFIX: loggerPrefix,

  SLACK_API_BASE_URL: 'https://slack.com/api/',

  // https://api.slack.com/events/reaction_added
  REACTION_ADDED: 'reaction_added',

  GITHUB_API_BASE_URL: 'https://api.github.com/'
};
