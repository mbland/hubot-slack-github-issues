'use strict';

var Logger = require('../lib/logger');
var constants = require('../lib/constants');
var sinon = require('sinon');
var chai = require('chai');

var expect = chai.expect;
chai.should();

describe('Logger', function() {
  var logger, infoSpy, errorSpy;

  beforeEach(function() {
    infoSpy = sinon.spy();
    errorSpy = sinon.spy();
    logger = new Logger({ info: infoSpy, error: errorSpy });
  });

  it('throws if the info method is missing', function() {
    var factory = function() {
      return new Logger({ error: errorSpy });
    };
    expect(factory).to.throw(Error, '"info"');
  });

  it('throws if the error method is missing', function() {
    var factory = function() {
      return new Logger({ info: infoSpy });
    };
    expect(factory).to.throw(Error, '"error"');
  });

  it('should prefix info messages with the script name', function() {
    logger.info(null, 'this', 'is', 'a', 'test');
    infoSpy.calledOnce.should.be.true;
    infoSpy.args[0].should.eql(
      [constants.LOGGER_PREFIX, 'this', 'is', 'a', 'test']);
  });

  it('should prefix info messages with the script name + msg ID', function() {
    logger.info('U5150+COU812', 'msgID', 'test');
    infoSpy.calledOnce.should.be.true;
    infoSpy.args[0].should.eql(
      [constants.LOGGER_PREFIX, 'U5150+COU812:', 'msgID', 'test']);
  });

  it('should prefix error messages with the script name', function() {
    logger.error(null, 'this', 'is', 'a', 'test');
    errorSpy.calledOnce.should.be.true;
    errorSpy.args[0].should.eql(
      [constants.LOGGER_PREFIX, 'this', 'is', 'a', 'test']);
  });
});
