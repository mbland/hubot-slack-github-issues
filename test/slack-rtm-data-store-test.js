'use strict';

var SlackRtmDataStore = require('../lib/slack-rtm-data-store');
var helpers = require('./helpers');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);

describe('SlackRtmDataStore', function() {
  var rtmDataStore;

  before(function() {
    rtmDataStore = new SlackRtmDataStore(helpers.rtmClient());
  });

  it('should return a Promise from getChannelInfo', function() {
    return rtmDataStore.getChannelById(helpers.CHANNEL_ID)
      .should.become({ id: helpers.CHANNEL_ID, name: helpers.CHANNEL_NAME });
  });

  it('should return a Promise from getTeamInfo', function() {
    return rtmDataStore.getTeamInfo(helpers.CHANNEL_ID)
      .should.become({ domain: helpers.TEAM_DOMAIN });
  });
});
