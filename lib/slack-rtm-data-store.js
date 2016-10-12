'use strict';

module.exports = SlackRtmDataStore;

// slackRtmClient should be of type RtmClient from @slack/client
function SlackRtmDataStore(slackRtmClient) {
  this.rtmClient = slackRtmClient;
}

SlackRtmDataStore.prototype.getChannelById = function(channelId) {
  return Promise.resolve(this.rtmClient.dataStore.getChannelById(channelId));
};

SlackRtmDataStore.prototype.getTeamInfo = function() {
  return Promise.resolve(
    this.rtmClient.dataStore.teams[this.rtmClient.activeTeamId]);
};
