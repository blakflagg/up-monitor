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
const _logs = require('./logs');
const util = require('util');
const debug = util.debuglog('workers');

//instantiate the worker object

workers = {};

//Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = function () {
  //Get all the checks that exist in the system
  _data.list('checks', function (err, checks) {
    if (!err && checks && checks.length > 0) {
      checks.forEach(function (check) {
        //Read in check data
        _data.read('checks', check, function (err, originalCheckData) {
          if (!err && originalCheckData) {
            //Pass it to the check validator, and let that function continue or log errors
            workers.validateCheckData(originalCheckData);
          } else {
            debug("error reading one of the check's data");
          }
        });
      });
    } else {
      debug("error: could not find any checks to process");
    }
  });
};
//Sanity check the check data
workers.validateCheckData = function (originalCheckData) {
  originalCheckData = typeof (originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
  originalCheckData.id = typeof (originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof (originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
  originalCheckData.protocol = typeof (originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
  originalCheckData.url = typeof (originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof (originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
  originalCheckData.successCodes = typeof (originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
  originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

  //Set the keys that may not be set (if the workers have not received this key before)
  originalCheckData.state = typeof (originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
  originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // if all the checks pass, pass the data along to the next step in the process
  if (originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.method &&
    originalCheckData.url &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds) {
    workers.performCheck(originalCheckData);
  } else {
    debug("Error: One of the checks is not properly formatted");
  }


};
// Perform the check, send the originalCheckData and the outcome of the check process to the next step
workers.performCheck = function (originalCheckData) {
  //prepare the initial check outcome
  let checkOutcome = {
    'error': false,
    'responseCode': false
  };

  // Mark that the outcome has not been sent yet
  let outcomeSent = false;
  // parse the hostname and the path out of the original check data
  let parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
  let hostname = parsedUrl.hostname;
  let path = parsedUrl.path; //Using path and not "pathname" because we want the querystring
  //Construct the request
  let requestDetails = {
    'protocol': originalCheckData.protocol + ':',
    'hostname': hostname,
    'method': originalCheckData.method.toUpperCase(),
    'path': path,
    'timeout': originalCheckData.timeoutSeconds * 1000
  };
  // Instantiate the request object using either the http or the https module

  let _moduleToUse = originalCheckData.protocol == "http" ? http : https;
  let req = _moduleToUse.request(requestDetails, function (res) {
    //Grab the status of the sent request
    let status = res.statusCode;
    //Update the check outcome and pass the data along
    checkOutcome.responseCode = status;
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //Bind to the error event so it doesn't get thrown
  req.on('error', function (e) {
    //update the check outcome and pass the data along
    checkOutcome.error = {
      'error': true,
      'value': e
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //Bind to the timeout event
  req.on('timeout', function (e) {
    //update the check outcome and pass the data along
    checkOutcome.error = {
      'error': true,
      'value': 'timeout'
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //end the request
  req.end();

};
// Process the check outcome, update the check data as needed, trigger an alert to the user
// Special logic for accomodating a check that has never been tested before (dont' want to alert on that one)


workers.processCheckOutcome = function (originalCheckData, checkOutcome) {
  //Decide if the check is up or down 
  let state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

  //Decide if an alert is warranted
  let alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

  // Log the outcome
  let timeOfCheck = Date.now();
  workers.log(originalCheckData,checkOutcome,state,alertWarranted,timeOfCheck);

  //Update the check data
  let newCheckData = originalCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = timeOfCheck; 
  

  // Save the updates
  _data.update('checks', newCheckData.id, newCheckData, function (err) {
    if (!err) {
      //Send the new check data to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData);
      } else {
        debug('Check outcome has not changed, no alert needed');
      }
    } else {
      debug("Error trying to save updates to one of the checks");
    }
  });
};

//Alert the user as to a change in their check status
workers.alertUserToStatusChange = function(newCheckData){
  let msg = 'Alert: your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+newCheckData.state ;
  helpers.sendTwilioSms(newCheckData.userPhone,msg,function(err){
    if(!err){
      debug('user was alerted to a status change in their check, via sms',msg);
    }else{
      debug('error, could not send sms alert to user who had a state change');
    }
  });

};

//Log
workers.log = function(originalCheckData,checkOutcome,state,alertWarranted,timeOfCheck){
  let logData = {
    'check' : originalCheckData,
    'outcome': checkOutcome,
    'state' : state,
    'alert' : alertWarranted,
    'time' : timeOfCheck
  };

  //Convert data to a string 
  let logString = JSON.stringify(logData);

  //Dertermine the name of the log file
  let logFileName = originalCheckData.id;

  // Append the log string to the file
  _logs.append(logFileName,logString, function(err){
    if(!err){
      debug('Logging to file succeeded');
    }else{
      debug('logging to file failed');
    }
  });
};

//Timer to execute the worker process once per minute
workers.loop = function () {
  setInterval(function () {
    workers.gatherAllChecks();
  }, 1000 * 60)
};

// Rotate (compress) the log files
workers.rotateLogs = function(){
  //List all the (non compressed) log files
  _logs.list(false,function(err,logs){
    if(!err && logs && logs.length > 0){
      logs.forEach(function(logName){
        //Compress the data to a different file
        let logId = logName.replace('.log','');
        let newFileId = logId+'-'+Date.now();
        _logs.compress(logId,newFileId,function(err){
          if(!err){
            //Truncate the log
            _logs.truncate(logId,function(err){
              if(!err){
                debug('success truncating log file');
              }else{
                debug('error truncating log file');
              }
            });
          }else{
            debug("Error compressing one of the log files",err);
          }
        });
      });
    }else{
      debug("Error : could not find any logs to rotate");

    }
  });
}
// Timer to execute the log-rotation process oncer per day
workers.logRotationLoop = function(){
  setInterval(function () {
    workers.rotateLogs();
  }, 1000 * 60 * 60 * 24)
};
// Init script
workers.init = function () {

  //Send to the console in yellow
  console.log('\x1b[33m%s\x1b[0m','Background workers are running');

  //Execute all the checks immediately
  workers.gatherAllChecks();
  //Call the loop so the checks will execute later on
  workers.loop();
};

// compress all the logs immediately
workers.rotateLogs();

// Call the compression loog so logs will be compressed later on
workers.logRotationLoop();

module.exports = workers;