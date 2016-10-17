'use strict';

var Rule = require('../lib/rule');
var chai = require('chai');
var expect = chai.expect;

describe('Rule', function() {
  var makeConfigRule = function() {
    return {
      reactionName: 'evergreen_tree',
      githubRepository: 'slack-github-issues',
      channelNames: ['bot-dev']
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

  describe('toLogString', function() {
    it('should stringify a Rule with channel names defined', function() {
      var configRule = makeConfigRule();
      configRule.channelNames.push('general');
      expect(new Rule(configRule).toLogString())
        .to.eql('reactionName: evergreen_tree, ' +
          'githubRepository: slack-github-issues, ' +
          'channelNames: bot-dev,general');
    });

    it('should stringify a Rule with no channel names defined', function() {
      var configRule = makeConfigRule();
      delete configRule.channelNames;
      expect(new Rule(configRule).toLogString())
        .to.eql('reactionName: evergreen_tree, ' +
          'githubRepository: slack-github-issues');
    });
  });

  it('should contain all the fields from the configuration', function() {
    var configRule = makeConfigRule(),
        rule = new Rule(configRule);
    expect(JSON.stringify(rule)).to.eql(JSON.stringify(configRule));
  });

  it('should match a message from one of the channelNames', function() {
    var rule = new Rule(makeConfigRule()),
        message = makeMessage();
    expect(rule.match(message, 'bot-dev')).to.be.true;
  });

  it('should ignore a message if its name does not match', function() {
    var configRule = makeConfigRule(),
        message = makeMessage(),
        rule;
    configRule.reactionName = 'sad-face';
    rule = new Rule(configRule);
    expect(rule.match(message, 'bot-dev')).to.be.false;
  });

  it('should match a message from any channel', function() {
    var rule = new Rule(makeConfigRule()),
        message = makeMessage();
    delete rule.channelNames;
    expect(rule.match(message, 'general')).to.be.true;
  });

  it('should ignore a message if its channel doesn\'t match', function() {
    var rule = new Rule(makeConfigRule()),
        message = makeMessage();
    expect(rule.match(message, 'not-bot-dev')).to.be.false;
  });
});
