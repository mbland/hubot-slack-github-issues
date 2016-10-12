'use strict';

var Middleware = require('../lib/middleware');
var Config = require('../lib/config');
var Rule = require('../lib/rule');
var GitHubClient = require('../lib/github-client');
var SlackClient = require('../lib/slack-client');
var Logger = require('../lib/logger');
var helpers = require('./helpers');
var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require('chai-as-promised');
var chaiThings = require('chai-things');

var expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiThings);

describe('Middleware', function() {
  var config, slackClient, githubClient, logger, middleware;

  beforeEach(function() {
    config = new Config(helpers.baseConfig());
    slackClient = new SlackClient(undefined, config);
    githubClient = new GitHubClient(config);
    logger = new Logger(console);
    middleware = new Middleware(config, slackClient, githubClient, logger);
  });

  describe('findMatchingRule', function() {
    var channelName, message;

    beforeEach(function() {
      channelName = 'not-any-channel-from-any-config-rule';
      message = helpers.reactionAddedMessage();
    });

    it('should find the rule matching the message', function() {
      var expected = config.rules[1],
          result = middleware.findMatchingRule(message, channelName);

      result.reactionName.should.equal(expected.reactionName);
      result.githubRepository.should.equal(expected.githubRepository);
      result.should.not.have.property('channelName');
    });

    it('should ignore a message if it is undefined', function() {
      expect(middleware.findMatchingRule(undefined, channelName))
        .to.be.undefined;
    });

    it('should ignore a message if its type does not match', function() {
      message.type = 'hello';
      expect(middleware.findMatchingRule(message, channelName)).to.be.undefined;
    });

    it('should ignore a message if its item type does not match', function() {
      message.item.type = 'file';
      expect(middleware.findMatchingRule(message, channelName)).to.be.undefined;
    });

    it('should ignore messages that do not match any rule', function() {
      message.reaction = 'sad-face';
      expect(middleware.findMatchingRule(message, channelName)).to.be.undefined;
    });
  });

  describe('parseMetadata', function() {
    it('should parse GitHub request metadata from a message', function() {
      middleware.parseMetadata(helpers.messageWithReactions(), 'bot-dev')
        .should.eql(helpers.metadata());
    });
  });

  describe('execute', function() {
    var message, checkErrorResponse;

    beforeEach(function() {
      message = helpers.reactionAddedMessage();

      slackClient = sinon.stub(slackClient);
      githubClient = sinon.stub(githubClient);
      logger = sinon.stub(logger);

      slackClient.getChannelName.returns(Promise.resolve('bot-dev'));
      slackClient.getTeamDomain.returns(Promise.resolve('mbland'));

      slackClient.getReactions
        .returns(Promise.resolve(helpers.messageWithReactions()));
      githubClient.fileNewIssue.returns(Promise.resolve(helpers.ISSUE_URL));
      slackClient.addSuccessReaction
        .returns(Promise.resolve(helpers.ISSUE_URL));
    });

    it('should receive a message and file an issue', function() {
      return middleware.execute(message)
        .should.become(helpers.ISSUE_URL).then(function() {
          var matchingRule = new Rule(helpers.baseConfig().rules[0]);

          logger.info.args.should.eql([
            helpers.logArgs('matches rule:', matchingRule.toLogString()),
            helpers.logArgs('getting reactions for', helpers.PERMALINK),
            helpers.logArgs('making GitHub request for', helpers.PERMALINK),
            helpers.logArgs('adding', helpers.baseConfig().successReaction),
            helpers.logArgs('created: ' + helpers.ISSUE_URL)
          ]);
        });
    });

    it('should ignore messages that do not match', function() {
      message.type = 'reaction_removed';
      expect(middleware.execute(message)).to.be.rejectedWith(null);
    });

    it('should not file another issue for the same message when ' +
      'one is in progress', function() {
      var result;

      result = middleware.execute(message);
      return middleware.execute(message).
        should.be.rejectedWith(null).then(function() {
          return result.should.become(helpers.ISSUE_URL).then(function() {
            logger.info.args.should.include.something.that.deep.equals(
              helpers.logArgs('already in progress'));

            // Make another call to ensure that the ID is cleaned up. Normally
            // the message will have a successReaction after the first
            // successful request, but we'll test that in another case.
            return middleware.execute(message).should.become(helpers.ISSUE_URL);
          });
        });
    });

    it('should not file another issue for the same message when ' +
      'one is already filed ', function() {
      var messageWithReactions = helpers.messageWithReactions();

      messageWithReactions.message.reactions.push({
        name: config.successReaction,
        count: 1,
        users: [ helpers.USER_ID ]
      });
      slackClient.getReactions.returns(Promise.resolve(messageWithReactions));

      return middleware.execute(message)
        .should.be.rejectedWith(null).then(function() {
          slackClient.getReactions.calledOnce.should.be.true;
          githubClient.fileNewIssue.called.should.be.false;
          slackClient.addSuccessReaction.called.should.be.false;
          logger.info.args.should.include.something.that.deep.equals(
            helpers.logArgs('already processed:', helpers.PERMALINK));
        });
    });

    checkErrorResponse = function(errorMessage) {
      logger.error.args.should.have.deep.property('[0][0]', helpers.MESSAGE_ID);
      logger.error.args.should.have.deep.property('[0][1]', errorMessage);
    };

    it('should receive a message but fail to get reactions', function() {
      var errorMessage = 'failed to get reactions for ' + helpers.PERMALINK +
        ': test failure';

      slackClient.getReactions
        .returns(Promise.reject(new Error('test failure')));

      return middleware.execute(message)
        .should.be.rejectedWith(errorMessage).then(function() {
          slackClient.getReactions.calledOnce.should.be.true;
          githubClient.fileNewIssue.called.should.be.false;
          slackClient.addSuccessReaction.called.should.be.false;
          checkErrorResponse(errorMessage);
        });
    });

    it('should get reactions but fail to file an issue', function() {
      var errorMessage = 'failed to create a GitHub issue in ' +
        'mbland/slack-github-issues: test failure';

      githubClient.fileNewIssue
        .returns(Promise.reject(new Error('test failure')));

      return middleware.execute(message)
        .should.be.rejectedWith(errorMessage).then(function() {
          slackClient.getReactions.calledOnce.should.be.true;
          githubClient.fileNewIssue.calledOnce.should.be.true;
          slackClient.addSuccessReaction.called.should.be.false;
          checkErrorResponse(errorMessage);
        });
    });

    it('should file an issue but fail to add a reaction', function() {
      var errorMessage = 'created ' + helpers.ISSUE_URL +
        ' but failed to add ' + helpers.baseConfig().successReaction +
        ': test failure';

      slackClient.addSuccessReaction
        .returns(Promise.reject(new Error('test failure')));

      return middleware.execute(message)
        .should.be.rejectedWith(errorMessage).then(function() {
          slackClient.getReactions.calledOnce.should.be.true;
          githubClient.fileNewIssue.calledOnce.should.be.true;
          slackClient.addSuccessReaction.calledOnce.should.be.true;
          checkErrorResponse(errorMessage);
        });
    });

    it('should catch and log unanticipated errors', function() {
      var errorMessage = 'unhandled error: Error\nmessage: ' +
            JSON.stringify(helpers.reactionAddedMessage(), null, 2);

      slackClient.getChannelName.throws();
      return middleware.execute(message)
        .should.be.rejectedWith(errorMessage).then(function() {
          logger.error.args.should.eql([[null, errorMessage]]);
        });
    });
  });
});
