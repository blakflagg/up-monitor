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

//Instantiate the server module object
let server = {};

server.httpServer = http.createServer(function (req, res) {
  unifiedServer(req,res);
});

server.httpsServerOptions = {
  'key' :  fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
  'cert' : fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
}


server.httpsServer = https.createServer(server.httpsServerOptions,function(req,res){
  server.unifiedServer(req,res);

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

    //Construct the data object to send to the handler
    let data = {
      'trimmedPath': trimmedPath,
      'queryStringObject': queryStringObject,
      'method': method,
      'headers': headers,
      'payload': helpers.parseJsonToObject(buffer)
    };

    //Route the request to the handler specified in the router

    chosenHandler(data, function (statusCode, payload) {
      //use the status code called back by the handler or default to 200
      statusCode = typeof (statusCode) == 'number' ? statusCode : 200;

      payload = typeof (payload) == 'object' ? payload : {};
      // convert the payload to a string
      let payloadString = JSON.stringify(payload);
      //Return the response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statusCode);
      res.end(payloadString);
      console.log('Returning this response: ', statusCode, payloadString);

    });

  });
}


//Define a request router

server.router = {
  'ping': handlers.ping,
  'users' : handlers.users,
  'tokens' : handlers.tokens,
  'checks' : handlers.checks
};

// Init script
server.init = function(){
  //Start the http server
  server.httpServer.listen(config.httpPort, function () {
    console.log('server listening on port ' + config.httpPort);
  });

  //Start the https server
  server.httpsServer.listen(config.httpsPort, function () {
    console.log('server listening on port ' + config.httpsPort);
  });
}
module.exports = server;