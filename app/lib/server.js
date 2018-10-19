/*
* Server-related tasks
*
*/

const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');
const debug = util.debuglog('server');

//Instantiate the server module object
let server = {};

server.httpServer = http.createServer(function (req, res) {
  server.unifiedServer(req, res);
});

server.httpsServerOptions = {
  'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}


server.httpsServer = https.createServer(server.httpsServerOptions, function (req, res) {
  server.unifiedServer(req, res);

});

server.unifiedServer = function (req, res) {
  //get the url and parse it 
  let parsedUrl = url.parse(req.url, true);

  //get the path from the url
  let path = parsedUrl.pathname;
  let trimmedPath = path.replace(/^\/+|\/+$/g, '');

  //get the query string as an objec
  let queryStringObject = parsedUrl.query;


  //get the HTTP method
  let method = req.method.toLowerCase();

  //get the headers as an object
  let headers = req.headers;

  //get the payload if any
  let decoder = new StringDecoder('utf-8');
  let buffer = '';

  req.on('data', function (data) {
    buffer += decoder.write(data);
  });

  req.on('end', function () {
    buffer += decoder.end();
    //choose the handler this request should go to, if one is not found use the not found handler
    let chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

    //If the reques tis within the public directory, use the public handler instead
    chosenHandler = trimmedPath.indexOf('public/') > -1 ? handlers.public : chosenHandler;

    //Construct the data object to send to the handler
    let data = {
      'trimmedPath': trimmedPath,
      'queryStringObject': queryStringObject,
      'method': method,
      'headers': headers,
      'payload': helpers.parseJsonToObject(buffer)
    };

    //Route the request to the handler specified in the router
    try {
      chosenHandler(data, function (statusCode, payload, contentType) {
        server.processHandlerResponse(res, method, trimmedPath, statusCode, payload, contentType);
      });
    } catch (error) {
      debug(error);
      server.processHandlerResponse(res, method, trimmedPath, 500, { "Error" : "An unknown error has occured" },'json');
    }


  });
}

//Process the response from the handler
server.processHandlerResponse = (res, method, trimmedPath, statusCode, payload,contentType) => {
  //Determine the type of response (fallback to JSON)
  contentType = typeof (contentType) == 'string' ? contentType : 'json';
  //use the status code called back by the handler or default to 200
  statusCode = typeof (statusCode) == 'number' ? statusCode : 200;

  //Return the response parts that are content-specific
  let payloadString = '';
  if (contentType == 'json') {
    res.setHeader('Content-Type', 'application/json');
    payload = typeof (payload) == 'object' ? payload : {};
    payloadString = JSON.stringify(payload);
  }
  if (contentType == 'html') {
    res.setHeader('Content-Type', 'text/html');
    payloadString = typeof (payload) == 'string' ? payload : '';

  }
  if (contentType == 'favicon') {
    res.setHeader('Content-Type', 'image/x-icon');
    payloadString = typeof (payload) !== 'undefined' ? payload : '';

  }
  if (contentType == 'css') {
    res.setHeader('Content-Type', 'text/css');
    payloadString = typeof (payload) !== 'undefined' ? payload : '';

  }
  if (contentType == 'png') {
    res.setHeader('Content-Type', 'image/png');
    payloadString = typeof (payload) !== 'undefined' ? payload : '';

  }
  if (contentType == 'jpg') {
    res.setHeader('Content-Type', 'image/jpeg');
    payloadString = typeof (payload) !== 'undefined' ? payload : '';

  }
  if (contentType == 'plain') {
    res.setHeader('Content-Type', 'text/plain');
    payloadString = typeof (payload) !== 'undefined' ? payload : '';
  }

  //Return the response parts that are common to all content types

  res.writeHead(statusCode);
  res.end(payloadString);

  //If the response is 200, print green otherwise print red
  if (statusCode == 200) {
    debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + '/' + trimmedPath + ' ' + statusCode);
  } else {

    debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + '/' + trimmedPath + ' ' + statusCode);
  }
  debug('Returning this response: ', statusCode, payloadString);
};

//Define a request router

server.router = {
  '': handlers.index,
  'account/create': handlers.accountCreate,
  'account/edit': handlers.accountEdit,
  'account/deleted': handlers.accountDeleted,
  'session/create': handlers.sessionCreate,
  'session/deleted': handlers.sessionDeleted,
  'checks/all': handlers.checksList,
  'checks/create': handlers.checksCreate,
  'checks/edit': handlers.checksEdit,
  'ping': handlers.ping,
  'api/users': handlers.users,
  'api/tokens': handlers.tokens,
  'api/checks': handlers.checks,
  'favicon.ico': handlers.favicon,
  'public': handlers.public,
  'examples/error': handlers.exampleError
};

// Init script
server.init = function () {
  //Start the http server
  server.httpServer.listen(config.httpPort, function () {
    console.log('\x1b[36m%s\x1b[0m', 'http server listening on port ' + config.httpPort); //console log is in color
  });

  //Start the https server
  server.httpsServer.listen(config.httpsPort, function () {
    console.log('\x1b[35m%s\x1b[0m', 'https server listening on port ' + config.httpsPort);//console log is in color
  });
}
module.exports = server;