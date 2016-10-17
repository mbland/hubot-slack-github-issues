'use strict';

var SlackClient = require('../lib/slack-client');
var constants = require('../lib/constants');
var ApiStubServer = require('./helpers/api-stub-server');
var helpers = require('./helpers');
var url = require('url');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);

function SlackDataStoreStub() {
  this.teamId = function() {
    return helpers.TEAM_ID;
  };

  this.channelById = function(_, channelInfoFromApi) {
    return channelInfoFromApi().then(function(response) {
      return response.channel;
    });
  };

  this.teamInfo = function(teamInfoFromApi) {
    return teamInfoFromApi().then(function(response) {
      return response.team;
    });
  };
}

describe('SlackClient', function() {
  var slackClient, dataStoreStub, config, slackApiServer, setResponse, payload,
      params;

  before(function() {
    slackApiServer = new ApiStubServer();
    config = helpers.baseConfig();
    config.slackApiBaseUrl = slackApiServer.address() + '/api/';
    dataStoreStub = new SlackDataStoreStub();
    slackClient = new SlackClient(dataStoreStub, config);
  });

  after(function() {
    slackApiServer.close();
  });

  afterEach(function() {
    slackApiServer.urlsToResponses = {};
  });

  setResponse = function(expectedUrl, expectedParams, statusCode, payload) {
    slackApiServer.urlsToResponses[expectedUrl] = {
      expectedParams: expectedParams,
      statusCode: statusCode,
      payload: payload
    };
  };

  describe('API base URL', function() {
    it('should parse the local server URL', function() {
      url.format(slackClient.baseurl).should.eql(
        slackApiServer.address() + '/api/');
      slackClient.requestFactory.globalAgent.protocol.should.eql('http:');
    });

    it('parses SLACK_API_BASE_URL if config base URL undefined', function() {
      var client = new SlackClient(undefined, helpers.baseConfig());
      url.format(client.baseurl).should.eql(constants.SLACK_API_BASE_URL);
      client.requestFactory.globalAgent.protocol.should.eql('https:');
    });
  });

  describe('messageId', function() {
    it('uses the team ID and the item channel ID and timestamp', function() {
      slackClient.messageId(helpers.reactionAddedMessage())
        .should.eql(helpers.MESSAGE_ID);
    });
  });

  describe('permalink', function() {
    it('uses the team domain name, channel name, and timestamp', function() {
      var teamInfo = { domain: helpers.TEAM_DOMAIN },
          channelInfo = { name: helpers.CHANNEL_NAME },
          message = helpers.reactionAddedMessage();

      slackClient.permalink(teamInfo, channelInfo, message)
        .should.eql(helpers.PERMALINK);
    });
  });

  describe('channelInfo', function() {
    it('should pass an API call to retrieve the info', function() {
      params = { channel: helpers.CHANNEL_ID, token: config.slackApiToken };
      payload = { ok: true, channel: { name: helpers.CHANNEL_NAME } };
      setResponse('/api/channels.info', params, 200, payload);
      return slackClient.channelInfo(helpers.CHANNEL_ID)
        .should.become({ name: helpers.CHANNEL_NAME });
    });
  });

  describe('teamInfo', function() {
    it('should pass an API call to retrieve the info', function() {
      params = { token: config.slackApiToken };
      payload = { ok: true, team: { domain: helpers.TEAM_DOMAIN } };
      setResponse('/api/team.info', params, 200, payload);
      return slackClient.teamInfo()
        .should.become({ domain: helpers.TEAM_DOMAIN });
    });
  });

  describe('getReactions', function() {
    beforeEach(function() {
      params = {
        channel: helpers.CHANNEL_ID,
        timestamp: helpers.TIMESTAMP,
        token: config.slackApiToken
      };
      payload = helpers.getReactionsResponse();
    });

    it('should make a successful request', function() {
      setResponse('/api/reactions.get', params, 200, payload);
      return slackClient.getReactions(helpers.CHANNEL_ID, helpers.TIMESTAMP)
        .should.become(payload);
    });

    it('should fail to make a request if the server is down', function() {
      var config = helpers.baseConfig(),
          slackClient;
      config.slackApiBaseUrl = 'http://localhost';
      slackClient = new SlackClient(undefined, config);

      return slackClient.getReactions(helpers.CHANNEL_ID, helpers.TIMESTAMP)
        .should.be.rejectedWith('failed to make Slack API request ' +
          'for method reactions.get:');
    });

    it('should make an unsuccessful request', function() {
      payload = {
        ok: false,
        error: 'not_authed'
      };
      setResponse('/api/reactions.get', params, 200, payload);
      return slackClient.getReactions(helpers.CHANNEL_ID, helpers.TIMESTAMP)
        .should.be.rejectedWith(Error, 'Slack API method reactions.get ' +
          'failed: ' + payload.error);
    });

    it('should make a request that produces a non-200 response', function() {
      setResponse('/api/reactions.get', params, 404, 'Not found');
      return slackClient.getReactions(helpers.CHANNEL_ID, helpers.TIMESTAMP)
        .should.be.rejectedWith(Error, 'received 404 response from ' +
          'Slack API method reactions.get: "Not found"');
    });
  });

  describe('addSuccessReaction', function() {
    beforeEach(function() {
      params = {
        channel: helpers.CHANNEL_ID,
        timestamp: helpers.TIMESTAMP,
        name: config.successReaction,
        token: config.slackApiToken
      };
      payload = { ok: true };
    });

    it('should make a successful request', function() {
      setResponse('/api/reactions.add', params, 200, payload);
      return slackClient.addSuccessReaction(
        helpers.CHANNEL_ID, helpers.TIMESTAMP).should.become(payload);
    });
  });
});
