'use strict';

module.exports = SlackRtmDataStore;

// slackRtmClient should be of type RtmClient from @slack/client
function SlackRtmDataStore(slackRtmClient) {
  this.rtmClient = slackRtmClient;
}

SlackRtmDataStore.prototype.getChannelName = function(channelId) {
  return this.rtmClient.dataStore.getChannelById(channelId).name;
};

SlackRtmDataStore.prototype.getTeamDomain = function() {
  return this.rtmClient.dataStore.teams[this.rtmClient.activeTeamId].domain;
};
