'use strict';

var constants = require('./constants');
var http = require('http');
var https = require('https');
var packageInfo = require('../package.json');
var url = require('url');

module.exports = GitHubClient;

function GitHubClient(config) {
  this.user = config.githubUser;
  this.apiToken = config.githubApiToken;
  this.timeout = config.githubTimeout;
  this.baseurl = url.parse(config.githubApiBaseUrl ||
    constants.GITHUB_API_BASE_URL);
  this.requestFactory = (this.baseurl.protocol === 'https:') ? https : http;
}

GitHubClient.prototype.fileNewIssue = function(metadata, repository) {
  return makeApiCall(this, metadata, repository);
};

function getHttpOptions(client, repository, paramsStr) {
  var baseurl = client.baseurl;
  return {
    protocol: baseurl.protocol,
    host: baseurl.hostname,
    port: baseurl.port,
    path: baseurl.pathname + 'repos/' + client.user + '/' + repository +
      '/issues',
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': 'token ' + client.apiToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(paramsStr, 'utf8'),
      'User-Agent': packageInfo.name + '/' + packageInfo.version
    }
  };
}

function makeApiCall(client, metadata, repository) {
  var paramsStr = JSON.stringify({
    title: metadata.title,
    body: metadata.url
  });

  return new Promise(function(resolve, reject) {
    var httpOptions = getHttpOptions(client, repository, paramsStr),
        req = client.requestFactory.request(httpOptions, function(res) {
          handleResponse(res, resolve, reject);
        });

    req.setTimeout(client.timeout);
    req.on('error', function(err) {
      reject(new Error('failed to make GitHub API request: ' + err.message));
    });
    req.end(paramsStr);
  });
}

function handleResponse(res, resolve, reject) {
  var result = '';

  res.setEncoding('utf8');
  res.on('data', function(chunk) {
    result = result + chunk;
  });
  res.on('end', function() {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        resolve(JSON.parse(result).html_url);
      } catch (err) {
        reject(new Error('could not parse JSON response from GitHub API: ' +
          result));
      }
    } else {
      reject(new Error('received ' + res.statusCode +
        ' response from GitHub API: ' + result));
    }
  });
}
