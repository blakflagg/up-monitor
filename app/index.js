const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./lib/config');
const fs = require('fs');
const handlers = require('./lib/handlers');
const helpers = require('./lib/helpers');




const httpServer = http.createServer(function (req, res) {
  unifiedServer(req,res);
});

const httpsServerOptions = {
  'key' :  fs.readFileSync('./https/key.pem'),
  'cert' : fs.readFileSync('./https/cert.pem')
}



const httpsServer = https.createServer(httpsServerOptions,function(req,res){
  unifiedServer(req,res);

});


httpServer.listen(config.httpPort, function () {
  console.log('server listening on port ' + config.httpPort);
});


httpsServer.listen(config.httpsPort, function () {
  console.log('server listening on port ' + config.httpsPort);
});

let unifiedServer = function (req, res) {
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
    let chosenHandler = typeof (router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

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

let router = {
  'ping': handlers.ping,
  'users' : handlers.users,
  'tokens' : handlers.tokens,
  'checks' : handlers.checks
};