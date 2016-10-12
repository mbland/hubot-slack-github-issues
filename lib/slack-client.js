'use strict';

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
  this.baseurl = url.parse(config.slackApiBaseUrl || SlackClient.API_BASE_URL);
  this.requestFactory = (this.baseurl.protocol === 'https:') ? https : http;
  this.makeApiCall = makeApiCall.bind(this);
}

SlackClient.API_BASE_URL = 'https://slack.com/api/';

// https://api.slack.com/events/reaction_added
// ReactionMessage (node_modules/hubot-slack/src/reaction-message.coffee) will
// trim the 'reaction_' prefix from 'reaction_added'.
SlackClient.REACTION_ADDED = 'added';

// https://api.slack.com/types/channel
// https://api.slack.com/methods/channels.info
SlackClient.prototype.getChannelName = function(channelId) {
  var getChannelInfo = makeApiCall.bind(
    this, 'channels.info', { channel: channelId });

  return this.dataStore.getChannelById(channelId, getChannelInfo)
    .then(function(channelInfo) {
      return channelInfo.name;
    });
};

SlackClient.prototype.getTeamDomain = function() {
  var getTeamInfo = makeApiCall.bind(this, 'team.info', { });

  return this.dataStore.getTeamInfo(getTeamInfo).then(function(teamInfo) {
    return teamInfo.domain;
  });
};

// https://api.slack.com/methods/reactions.get
SlackClient.prototype.getReactions = function(channel, timestamp) {
  return this.makeApiCall('reactions.get',
    { channel: channel, timestamp: timestamp });
};

// https://api.slack.com/methods/reactions.add
SlackClient.prototype.addSuccessReaction = function(channel, timestamp) {
  return this.makeApiCall('reactions.add',
    { channel: channel, timestamp: timestamp, name: this.successReaction });
};

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

function makeApiCall(method, params) {
  var client = this;

  return new Promise(function(resolve, reject) {
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
  });
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
