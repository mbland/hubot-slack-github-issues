'use strict';

var testConfig = require('./test-config.json');
var SlackClient = require('../../lib/slack-client');
var User = require('@slack/client/lib/models/user');
var ReactionMessage = require('hubot-slack/src/reaction-message');

exports = module.exports = {
  REACTION: 'evergreen_tree',
  USER_ID: 'U5150OU812',
  ITEM_USER_ID: 'U1984OU812',
  CHANNEL_ID: 'C5150OU812',
  TIMESTAMP: '1360782804.083113',
  PERMALINK: 'https://18f.slack.com/archives/handbook/p1360782804083113',
  ISSUE_URL: 'https://github.com/18F/handbook/issues/1',
  MESSAGE_ID: 'C5150OU812:1360782804.083113',

  baseConfig: function() {
    return JSON.parse(JSON.stringify(testConfig));
  },

  // https://api.slack.com/events/reaction_added
  reactionAddedMessage: function() {
    return {
      type: SlackClient.REACTION_ADDED,
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

  fullReactionAddedMessage: function() {
    var user, itemUser, message;
    message = exports.reactionAddedMessage();

    // https://api.slack.com/types/user
    // node_modules/hubot-slack/src/bot.coffee
    user = new User({ id: message.user, name: 'jquser' });
    user.room = message.item.channel;
    itemUser = new User({ id: message.item_user, name: 'rando' });

    // node_modules/hubot-slack/src/reaction-message.coffee
    return new ReactionMessage(message.type, user, message.reaction,
      itemUser, message.item, message.event_ts);
  },

  messageWithReactions: function() {
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
      channel: 'handbook',
      timestamp: exports.TIMESTAMP,
      url: exports.PERMALINK,
      date: new Date(1360782804.083113 * 1000),
      title: 'Update from #handbook at Wed, 13 Feb 2013 19:13:24 GMT'
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
  }
};
