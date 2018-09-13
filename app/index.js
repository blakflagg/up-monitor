/*
  * Primary file for the API
  * 
*/

//Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

//Declare the app
let app = {};

// Init function
app.init = function(){
  //Start the server
  server.init();

  //Start the workers
  workers.init();
};

//Execute
app.init();

module.exports = app;