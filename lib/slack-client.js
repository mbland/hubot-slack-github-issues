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
}

SlackClient.API_BASE_URL = 'https://slack.com/api/';

// https://api.slack.com/events/reaction_added
// ReactionMessage (node_modules/hubot-slack/src/reaction-message.coffee) will
// trim the 'reaction_' prefix from 'reaction_added'.
SlackClient.REACTION_ADDED = 'added';

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
  return this.dataStore.channelById(channelId,
    makeApiCall.bind(this, 'channels.info', { channel: channelId }));
};

// https://api.slack.com/methods/team.info
SlackClient.prototype.teamInfo = function() {
  return this.dataStore.teamInfo(makeApiCall.bind(this, 'team.info', {}));
};

// https://api.slack.com/methods/reactions.get
SlackClient.prototype.getReactions = function(channel, timestamp) {
  return makeApiCall.call(this, 'reactions.get',
    { channel: channel, timestamp: timestamp });
};

// https://api.slack.com/methods/reactions.add
SlackClient.prototype.addSuccessReaction = function(channel, timestamp) {
  return makeApiCall.call(this, 'reactions.add',
    { channel: channel, timestamp: timestamp, name: this.successReaction });
};

function makeApiCall(method, params) {
  return new Promise(sendRequest.bind(this, method, params));
}

function sendRequest(method, params, resolve, reject) {
  var httpOptions, req;

  params.token = this.apiToken;
  httpOptions = getHttpOptions.call(this, method, params);

  req = this.requestFactory.request(httpOptions, function(res) {
    handleResponse(method, res, resolve, reject);
  });

  req.setTimeout(this.timeout);
  req.on('error', function(err) {
    reject(new Error('failed to make Slack API request for method ' +
      method + ': ' + err.message));
  });
  req.end();
}

function getHttpOptions(method, queryParams) {
  var baseurl = this.baseurl;
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
