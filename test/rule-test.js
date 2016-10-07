'use strict';

var Rule = require('../lib/rule');
var SlackClient = require('../lib/slack-client');
var Channel = require('@slack/client/lib/models/channel');
var config = require('./helpers/test-config.json');
var chai = require('chai');
var expect = chai.expect;

function SlackClientImplStub(channelName) {
  var clientStub = this;
  this.channelName = channelName;

  this.dataStore = {
    getChannelById: function (channelId) {
      clientStub.channelId = channelId;
      // https://api.slack.com/types/channel
      return new Channel({ id: channelId, name: clientStub.channelName });
    }
  };
}

describe('Rule', function() {
  var makeConfigRule = function() {
    return {
      reactionName: 'evergreen_tree',
      githubRepository: 'hub',
      channelNames: ['hub']
    };
  };

  var makeMessage = function() {
    return {
      type: 'reaction_added',
      user: 'U024BE7LH',
      item_user: 'U1984OU812',  // eslint-disable-line camelcase
      item: {
        type: 'message',
        channel: 'C2147483705',
        ts: '1360782804.083113'
      },
      reaction: 'evergreen_tree',
      'event_ts': '1360782804.083113'
    };
  };

  it('should contain all the fields from the configuration', function() {
    var configRule = makeConfigRule(),
        rule = new Rule(configRule);
    expect(JSON.stringify(rule)).to.eql(JSON.stringify(configRule));
  });

  it('should match a message from one of the channelNames', function() {
    var rule = new Rule(makeConfigRule()),
        message = makeMessage(),
        slackClientImpl = new SlackClientImplStub('hub'),
        slackClient = new SlackClient(slackClientImpl, config);
    expect(rule.match(message, slackClient)).to.be.true;
    expect(slackClientImpl.channelId).to.eql(message.item.channel);
  });

  it('should ignore a message if its name does not match', function() {
    var configRule = makeConfigRule(),
        message = makeMessage(),
        slackClientImpl = new SlackClientImplStub('hub'),
        slackClient = new SlackClient(slackClientImpl, config),
        rule;

    configRule.reactionName = 'sad-face';
    rule = new Rule(configRule);

    expect(rule.match(message, slackClient)).to.be.false;
    expect(slackClientImpl.channelId).to.be.undefined;
  });

  it('should match a message from any channel', function() {
    var rule = new Rule(makeConfigRule()),
        message = makeMessage(),
        slackClientImpl = new SlackClientImplStub('hub'),
        slackClient = new SlackClient(slackClientImpl, config);

    delete rule.channelNames;
    expect(rule.match(message, slackClient)).to.be.true;
    expect(slackClientImpl.channelId).to.be.undefined;
  });

  it('should ignore a message if its channel doesn\'t match', function() {
    var rule = new Rule(makeConfigRule()),
        message = makeMessage(),
        slackClientImpl = new SlackClientImplStub('not-the-hub'),
        slackClient = new SlackClient(slackClientImpl, config);

    expect(rule.match(message, slackClient)).to.be.false;
    expect(slackClientImpl.channelId).to.eql(message.item.channel);
  });
});
