//API tests

//Dependencies
const app = require('./../index');
const assert = require('assert');
const http = require('http');
const config = require('./../lib/config');

// Holder for the tests
const api = {};

const helpers = {};

helpers.makeGetRequest = (path, callback) => {
  const requestDetails = {
    'protocol': 'http:',
    'hostname': 'localhost',
    'port': config.httpPort,
    'method': 'GET',
    'path': path,
    'headers': {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(requestDetails, (res) => {
    callback(res);
  });
  req.end();
};

//The main init() function should ve able to run without throwing
api['app.init should start without throwing'] = (done) => {
  assert.doesNotThrow(() => {
    app.init((err) => {
      done();
    });
  }, TypeError)
}


api['/api/users should respond to get with 400'] = (done) => {
  helpers.makeGetRequest('/api/users', (res) => {
    assert.equal(res.statusCode, 400);
    done();
  });
};

//Make a request to a random path should respond with 404
api['/randomPath should respond to get with 404'] = (done) => {
  helpers.makeGetRequest('/this/path/should/not/exist', (res) => {
    assert.equal(res.statusCode, 404);
    done();
  });
};

//Make a requiest to /ping
api['/ping should respond to get with 200'] = (done) => {
  helpers.makeGetRequest('/ping', (res) => {
    assert.equal(res.statusCode, 200);
    done();
  });
};




module.exports = api;