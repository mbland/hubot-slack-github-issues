'use strict';

var constants = require('./constants');
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var url = require('url');

module.exports = SlackClient;

function SlackClient(dataStore, config) {
  this.dataStore = dataStore;
  this.apiToken = config.slackApiToken;
  this.timeout = config.slackTimeout;
  this.successReaction = config.successReaction;
  this.baseurl = url.parse(config.slackApiBaseUrl ||
    constants.SLACK_API_BASE_URL);
  this.requestFactory = (this.baseurl.protocol === 'https:') ? https : http;
}

SlackClient.prototype.messageId = function(message) {
  return [
    this.dataStore.teamId(), message.item.channel,  message.item.ts
  ].join(':');
};

SlackClient.prototype.permalink = function(team, channel, message) {
  return 'https://' + team.domain + '.slack.com/archives/' +
    channel.name + '/p' + message.item.ts.replace('.', '');
};

// https://api.slack.com/types/channel
// https://api.slack.com/methods/channels.info
SlackClient.prototype.channelInfo = function(channelId) {
  var client = this;
  return this.dataStore.channelById(channelId, function() {
    return makeApiCall(client, 'channels.info', { channel: channelId });
  });
};

// https://api.slack.com/methods/team.info
SlackClient.prototype.teamInfo = function() {
  var client = this;
  return this.dataStore.teamInfo(function() {
    return makeApiCall(client, 'team.info', {});
  });
};

// https://api.slack.com/methods/reactions.get
SlackClient.prototype.getReactions = function(channel, timestamp) {
  return makeApiCall(this, 'reactions.get',
    { channel: channel, timestamp: timestamp });
};

// https://api.slack.com/methods/reactions.add
SlackClient.prototype.addSuccessReaction = function(channel, timestamp) {
  return makeApiCall(this, 'reactions.add',
    { channel: channel, timestamp: timestamp, name: this.successReaction });
};

function makeApiCall(client, method, params) {
  return new Promise(function(resolve, reject) {
    return sendRequest(client, method, params, resolve, reject);
  });
}

function sendRequest(client, method, params, resolve, reject) {
  var httpOptions, req;

  params.token = client.apiToken;
  httpOptions = getHttpOptions(client, method, params);

  req = client.requestFactory.request(httpOptions, function(res) {
    handleResponse(method, res, resolve, reject);
  });

  req.setTimeout(client.timeout);
  req.on('error', function(err) {
    reject(new Error('failed to make Slack API request for method ' +
      method + ': ' + err.message));
  });
  req.end();
}

function getHttpOptions(client, method, queryParams) {
  var baseurl = client.baseurl;
  return {
    protocol: baseurl.protocol,
    host: baseurl.hostname,
    port: baseurl.port,
    path: baseurl.pathname + method + '?' + querystring.stringify(queryParams),
    method: 'GET'
  };
}

function handleResponse(method, res, resolve, reject) {
  var result = '';

  res.setEncoding('utf8');
  res.on('data', function(chunk) {
    result = result + chunk;
  });
  res.on('end', function() {
    var parsed;

    if (res.statusCode >= 200 && res.statusCode < 300) {
      parsed = JSON.parse(result);

      if (parsed.ok) {
        resolve(parsed);
      } else {
        reject(new Error('Slack API method ' + method + ' failed: ' +
          parsed.error));
      }
    } else {
      reject(new Error('received ' + res.statusCode +
        ' response from Slack API method ' + method + ': ' + result));
    }
  });
}
