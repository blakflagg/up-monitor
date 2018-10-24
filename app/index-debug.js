/*
  * Primary file for the API
  * 
*/

//Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');
const cli = require('./lib/cli');
const exampleDebuggingProblem = require('./lib/exampleDebuggingProblem');

//Declare the app
let app = {};

// Init function
app.init = function(){
  //Start the server
  debugger;
  server.init();
  debugger;

  //Start the workers
  debugger;
  workers.init();
  debugger;

  // Start the CLI, but make sure it starts last
  setTimeout(function(){
    cli.init();
  },50);

  let foo = 1;

  foo++

  foo = foo*foo;

  foo = foo.toString();

  exampleDebuggingProblem.init();
};

//Execute
app.init();

module.exports = app;