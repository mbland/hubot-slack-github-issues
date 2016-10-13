'use strict';

module.exports = MessageLock;

function MessageLock() {
  this.inProgress = {};
}

MessageLock.prototype.lock = function(messageId) {
  if (this.inProgress[messageId]) {
    return Promise.resolve(false);
  }
  this.inProgress[messageId] = true;
  return Promise.resolve(messageId);
};

MessageLock.prototype.unlock = function(messageId) {
  delete this.inProgress[messageId];
  return Promise.resolve(messageId);
};
