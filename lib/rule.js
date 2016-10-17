'use strict';

module.exports = Rule;

function Rule(configRule) {
  this.reactionName = configRule.reactionName;
  this.githubRepository = configRule.githubRepository;
  this.channelNames = configRule.channelNames;
}

Rule.prototype.toLogString = function() {
  var properties = [
    'reactionName: ' + this.reactionName,
    'githubRepository: ' + this.githubRepository
  ];

  if (this.channelNames) {
    properties.push('channelNames: ' + this.channelNames);
  }
  return properties.join(', ');
};

Rule.prototype.match = function(message, channelName) {
  return (this.reactionMatches(message) &&
    this.channelMatches(message, channelName));
};

Rule.prototype.reactionMatches = function(message) {
  return message.reaction === this.reactionName;
};

Rule.prototype.channelMatches = function(message, channelName) {
  var channels = this.channelNames;
  return channels === undefined || channels.indexOf(channelName) !== -1;
};
