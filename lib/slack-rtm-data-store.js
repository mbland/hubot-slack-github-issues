'use strict';

module.exports = SlackRtmDataStore;

// slackRtmClient should be of type RtmClient from @slack/client
function SlackRtmDataStore(slackRtmClient) {
  this.rtmClient = slackRtmClient;
}

SlackRtmDataStore.prototype.teamId = function() {
  return this.rtmClient.activeTeamId;
};

SlackRtmDataStore.prototype.channelById = function(channelId) {
  return Promise.resolve(this.rtmClient.dataStore.getChannelById(channelId));
};

SlackRtmDataStore.prototype.teamInfo = function() {
  return Promise.resolve(this.rtmClient.dataStore.teams[this.teamId()]);
};
