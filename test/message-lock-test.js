'use strict';

var MessageLock = require('../lib/message-lock');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);

describe('MessageLock', function() {
  var messageLock;

  beforeEach(function() {
    messageLock = new MessageLock;
  });

  it ('returns the message ID when the lock is acquired', function() {
    return messageLock.lock('msgId').should.become('msgId');
  });

  it ('returns the message ID when the lock is released', function() {
    return messageLock.lock('msgId').should.become('msgId').then(function() {
      return messageLock.unlock('msgId').should.become('msgId');
    });
  });

  it ('prevents a second lock until the first is released', function() {
    return messageLock.lock('msgId').should.become('msgId')
      .then(function() {
        return messageLock.lock('msgId').should.become(false);
      })
      .then(function() {
        return messageLock.lock('msgId').should.become(false);
      })
      .then(function() {
        return messageLock.unlock('msgId').should.become('msgId');
      })
      .then(function() {
        return messageLock.lock('msgId').should.become('msgId');
      })
      .then(function() {
        return messageLock.lock('msgId').should.become(false);
      });
  });
});
