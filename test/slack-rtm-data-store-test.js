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

  it('returns the team ID directly', function() {
    rtmDataStore.teamId().should.equal(helpers.TEAM_ID);
  });

  it('returns a Promise from channelById', function() {
    return rtmDataStore.channelById(helpers.CHANNEL_ID)
      .should.become({ id: helpers.CHANNEL_ID, name: helpers.CHANNEL_NAME });
  });

  it('returns a Promise from teamInfo', function() {
    return rtmDataStore.teamInfo(helpers.CHANNEL_ID)
      .should.become({ domain: helpers.TEAM_DOMAIN });
  });
});
