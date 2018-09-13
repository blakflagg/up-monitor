/*
* work-related tasks
*
*/

//Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');

//instantiate the worker object

workers = {};

//Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = function(){
  //Get all the checks that exist in the system
  _data.list('checks',function(err,checks){
    if(!err && checks && checks.length > 0){
      checks.forEach(function(check){
        //Read in check data
        _data.read('checks',check,function(err,originalCheckData){
          if(!err && originalCheckData){
            //Pass it to the check validator, and let that function continue or log errors
            workers.validateCheckData(originalCheckData);
          }else{
            console.log("error reading one of the check's data");
          }
        });
      });
    }else{
      console.log("error: could not find any checks to process");
    }
  });
};
//Sanity check the check data
workers.validateCheckData = function(originalCheckData){
  originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
  originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
  originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http','https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
  originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post','get','put','delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
  originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckDataoriginalCheckData.successCodes : false;
  originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >=1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

  //Set the keys that may not be set (if the workers have not received this key before)
  originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
  originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // if all the checks pass, pass the data along to the next step in the process
  if(originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.method &&
    originalCheckData.url &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds){
    workers.performCheck(originalCheckData);
    }else{
      console.log("Error: One of the checks is not properly formatted");
    }


};
// Perform the check, send the originalCheckData and the outcome of the check process to the next step
workers.performCheck = function(originalCheckData){
  //prepare the initial check outcome
  let checkOutcome = {
    'error' : false,
    'responseCode' : false
  };

  // Mark that the outcome has not been sent yet
  let outcomeSent = false;
  // parse the hostname and the path out of the original check data
  let parsedUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url,true);
  
};

//Timer to execute the worker process once per minute
workers.loop = function(){
  setInterval(function(){
    workers.gatherAllChecks();
  },1000 * 60)
};
// Init script
workers.init = function(){
  //Execute all the checks immediately
  workers.gatherAllChecks();
  //Call the loop so the checks will execute later on
  workers.loop();
};
module.exports = workers;