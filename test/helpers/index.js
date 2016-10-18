'use strict';

var testConfig = require('./test-config.json');
var constants = require('../../lib/constants');

exports = module.exports = {
  REACTION: 'evergreen_tree',
  TEAM_ID: 'T19845150',
  TEAM_DOMAIN: 'mbland',
  USER_ID: 'U5150OU812',
  ITEM_USER_ID: 'U1984OU812',
  CHANNEL_ID: 'C5150OU812',
  CHANNEL_NAME: 'bot-dev',
  TIMESTAMP: '1360782804.083113',
  PERMALINK: 'https://mbland.slack.com/archives/bot-dev/p1360782804083113',
  ISSUE_URL: 'https://github.com/mbland/slack-github-issues/issues/1',
  MESSAGE_ID: 'T19845150:C5150OU812:1360782804.083113',

  baseConfig: function() {
    return JSON.parse(JSON.stringify(testConfig));
  },

  rtmClient: function() {
    return {
      dataStore: {
        getChannelById: function(channelId) {
          return { id: channelId, name: exports.CHANNEL_NAME };
        },
        teams: {
          T19845150: { domain: exports.TEAM_DOMAIN }
        }
      },
      activeTeamId: exports.TEAM_ID
    };
  },

  // https://api.slack.com/events/reaction_added
  reactionAddedMessage: function() {
    return {
      type: constants.REACTION_ADDED,
      user: exports.USER_ID,
      reaction: exports.REACTION,
      item_user: exports.ITEM_USER_ID, // eslint-disable-line camelcase
      item: {
        type: 'message',
        channel: exports.CHANNEL_ID,
        ts: exports.TIMESTAMP
      },
      'event_ts': exports.TIMESTAMP
    };
  },

  getReactionsResponse: function() {
    return {
      ok: true,
      type: 'message',
      channel: exports.CHANNEL_ID,
      message: {
        type: 'message',
        ts: exports.TIMESTAMP,
        permalink: exports.PERMALINK,
        reactions: [
        ]
      }
    };
  },

  metadata: function() {
    return {
      channel: exports.CHANNEL_NAME,
      timestamp: exports.TIMESTAMP,
      url: exports.PERMALINK,
      date: new Date(1360782804.083113 * 1000),
      title: 'Update from #' + exports.CHANNEL_NAME +
        ' at Wed, 13 Feb 2013 19:13:24 GMT'
    };
  },

  logArgs: function() {
    var args = new Array(arguments.length),
        i;

    for (i = 0; i !== args.length; ++i) {
      args[i] = arguments[i];
    }
    args.unshift(exports.MESSAGE_ID);
    return args;
  },

  // resolveNextTick and rejectNextTick ensure that the event loop is flushed
  // after a Promise is resolved or rejected.
  //
  // Usage:
  //   var helpers = require('./helpers');
  //   funcReturningPromise()
  //     .then(helpers.resolveNextTick, helpers.rejectNextTick);
  resolveNextTick: function(value) {
    return new Promise(function(resolve) {
      process.nextTick(function() { resolve(value); });
    });
  },

  rejectNextTick: function(err) {
    return new Promise(function(_, reject) {
      process.nextTick(function() { reject(err); });
    });
  }
};
