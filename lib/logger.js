'use strict';

var constants = require('./constants');

module.exports = Logger;

function checkForMethod(logger, methodName) {
  if (!logger[methodName]) {
    throw new Error('the underlying logger implementation must support ' +
      'the "' + methodName + '" method');
  }
}

function Logger(logger) {
  checkForMethod(logger, 'info');
  checkForMethod(logger, 'error');
  this.logger = logger;
}

Logger.prototype.info = function() {
  this.logger.info.apply(this.logger, addPrefix.apply(null, arguments));
};

Logger.prototype.error = function() {
  this.logger.error.apply(this.logger, addPrefix.apply(null, arguments));
};

function addPrefix() {
  var args = new Array(arguments.length),
      i;

  for (i = 0; i !== args.length; ++i) {
    args[i] = arguments[i];
  }

  if (args.length !== 0 && args[0]) {
    args[0] = args[0] + ':';
  } else {
    args.shift();
  }
  args.unshift(constants.LOGGER_PREFIX);
  return args;
}
