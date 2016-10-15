'use strict';

module.exports = Rule;

function Rule(configRule) {
  for (var property in configRule) {
    if (configRule.hasOwnProperty(property)) {
      this[property] = configRule[property];
    }
  }
}

Rule.prototype.toLogString = function() {
  return Object.keys(this).map(function(propertyName) {
    return propertyName + ': ' + this[propertyName];
  }, this).join(', ');
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
