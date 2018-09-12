/*  
* Request handlers
*/

//Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');
//Define the handlers
let handlers = {};

//Users

handlers.users = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

//container for the users submethods
handlers._users = {};

//Users - post
//Required data: firstName, lastname, phone, password, tosAgreement
//Optional data: none
handlers._users.post = function (data, callback) {
  //Check that all required fields are filled out
  let firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  let lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  let phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  let password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  let tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    //make sure the user doesn't already exist
    _data.read('users', phone, function (err, data) {
      if (err) {
        //Hash the password
        let hashedPassword = helpers.hash(password);
        if (hashedPassword) {

          //Create the user object
          let userObject = {
            'firstName': firstName,
            'lastName': lastName,
            'phone': phone,
            'hashedPassword': hashedPassword,
            'tosAgreement': true
          };

          //Store the user
          _data.create('users', phone, userObject, function (err) {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { 'Error': 'A user with the phone number already exists' });
            }
          });
        } else {
          callback(500, { 'Error': 'Could not hash the user\'s password' });
        }
      } else {
        callback(400, { 'Error': 'A user with that phone number already exists' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }

};

//Users -get 
//Required data: phone
//Optional data: none

handlers._users.get = function (data, callback) {
  //check that the phone number is provided
  let phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    //Get the token from the headers
    let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    //Verify that the given toek is valid for the phone number
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
      if (tokenIsValid) {

        _data.read('users', phone, function (err, data) {
          if (!err && data) {
            //remove the hashed password before returning it to the requestor
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        })
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });

      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};
//Users -put 
//Required data: phone
//Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = function (data, callback) {

  let phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  //Check for the optional fields
  let firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  let lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  let password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  //Error if the phone is not valid
  if (phone) {
    if (firstName || lastName || password) {
      let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
      handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
        if (tokenIsValid) {
          //Lookup the user
          _data.read('users', phone, function (err, userData) {
            if (!err && userData) {
              //Update the fields that are necessary
              if (firstName) {
                userData.firstName = firstName;
              }
              if (lastName) {
                userData.lastName = lastName;
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password);
              }

              //Store the user data updates
              _data.update('users', phone, userData, function (err) {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { 'Error': 'Could not update the user' });
                }
              })

            } else {
              callback(400, { 'Error': 'The specified user does not exist' });
            }
          });
        } else {

          callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
        }
      });

    } else {
      callback(400, { 'Error': 'Missing fields to update' });
    }
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

//Users -delete 
//Required: phone
handlers._users.delete = function (data, callback) {
  //Check that the phone is valid
  let phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
      if (tokenIsValid) {
        _data.read('users', phone, function (err, userData) {
          if (!err && userData) {
            _data.delete('users', phone, function (err) {
              if (!err) {
                //Delete each of the check associated with the user
                    let userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                    let checksToDelete = userChecks.length;
                    if(checksToDelete > 0){
                      let checksDeleted = 0;
                      let deletionErrors =false;
                      //Loop through the checks
                      userChecks.forEach(function(checkId){
                        //Delete the check
                        _data.delete('checks',checkId,function(err){
                          if(err){
                            deletionErrors = true;
                          }
                          checksDeleted++;
                          if(checksDeleted == checksToDelete){
                            if(!deletionErrors){
                              callback(200);
                            }else{
                              callback(500,{'Errors':'Errors encountered while trying to delete all checks, all checks may not have been deleted successfully'});
                            }
                          }
                        });
                      });
                    }else{
                      callback(200);
                    }
              } else {
                callback(500, { 'Error': 'Could not delete the specified user' });
              }
            });
          } else {
            callback(400, { 'Error': 'Could not find the specified user' });
          }
        });
      } else {

        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

//Ping Handler
handlers.ping = function (data, callback) {
  callback(200);
};

//Not found handler
handlers.notFound = function (data, callback) {
  callback(404);
};

//Tokens
handlers.tokens = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};
//Container for all the tokens methods

handlers._tokens = {};
//Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function (id, phone, callback) {
  //Lookup the token
  _data.read('tokens', id, function (err, tokenData) {
    if (!err && tokenData) {
      //Check that the token is for the given user and has not expired
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  })
};

//Tokens - post
//Required data: phone, password
handlers._tokens.post = function (data, callback) {
  let phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  let password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  if (phone && password) {
    //Lookup the user who matches the phone number
    _data.read('users', phone, function (err, userData) {
      if (!err && userData) {
        //Hash the sent password, and compare it to the password stored in the user object
        let hashedPassword = helpers.hash(password);
        if (hashedPassword == userData.hashedPassword) {
          //If valid create a new token with random name. set expiration data 1 hour
          let tokenId = helpers.createRandomString(20);
          let expires = Date.now() + 1000 * 60 * 60;
          let tokenObject = {
            'phone': phone,
            'id': tokenId,
            'expires': expires
          };

          //Store the token
          _data.create('tokens', tokenId, tokenObject, function (err) {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { 'Error': 'Could not create the token' });
            }
          });

        } else {
          callback(400, { 'Error': 'Password is incorrect' });
        }
      } else {
        callback(400, { 'Error': 'Cound not find the specified user' });
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }
};

//Tokens - get
//Required data: id
handlers._tokens.get = function (data, callback) {
  //check that the phone number is provided
  let id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

  if (id) {
    _data.read('tokens', id, function (err, tokenData) {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

//Tokens - put
//Required data: id, extend
handlers._tokens.put = function (data, callback) {
  let id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  let extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
  if (id && extend) {
    _data.read('tokens', id, function (err, tokenData) {
      if (!err && tokenData) {
        if (tokenData.expires > Date.now()) {
          tokenData.expires = Date.now() + 1000 * 60 * 60;

          //Store the new updates
          _data.update('tokens', id, tokenData, function (err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, { 'Error': 'Could not update the tokens expiration' })
            }
          });
        } else {
          callback(400, { 'Error': 'The token has already expired, and cannot be extended' });
        }
      } else {
        callback(400, { 'Error': 'Specified token does not exist' });
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required fields or field(s) are invalid' });
  }
};

//Tokens - delete
handlers._tokens.delete = function (data, callback) {
  //Check that the phone is valid
  let id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    _data.read('tokens', id, function (err, data) {
      if (!err && data) {
        _data.delete('tokens', id, function (err, data) {
          if (!err) {
            callback(200);
          } else {
            callback(500, { 'Error': 'Could not delete the specified token' });
          }
        });
      } else {
        callback(400, { 'Error': 'Could not find the specified token' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

//Checks
handlers.checks = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};
//Container for all the checks methods
handlers._checks = {};

//Checks - post
//Required data: protocol, url, method, successCodes, timeoutSeconds
//Optional data: none

handlers._checks.post = function (data, callback) {
  //Validate inputs

  let protocol = typeof (data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  let url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  let method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  let successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  let timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    //Get the token from the headers
    let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    //Lookup the user by reading the token
    _data.read('tokens', token, function (err, tokenData) {
      if (!err && tokenData) {
        let userPhone = tokenData.phone;

        //lookup the user data
        _data.read('users', userPhone, function (err, userData) {
          if (!err && userData) {
            let userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
            //Verify that the user has less than the number max-checks-per-user
            if (userChecks.length < config.maxChecks) {
              //create a random id for the check
              let checkId = helpers.createRandomString(20);
              //Create the check object and include the users phone
              let checkObject = {
                'id': checkId,
                'userPhone': userPhone,
                'protocol': protocol,
                'url': url,
                'method': method,
                'successCodes': successCodes,
                'timeoutSeconds': timeoutSeconds
              };
              //Save the object
              _data.create('checks', checkId, checkObject, function (err) {
                if (!err) {
                  //Add the check id to the user's object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  //Save the new user data
                  _data.update('users', userPhone, userData, function (err) {
                    if (!err) {
                      callback(200, checkObject);
                    } else {
                      callback(500, { 'Error': 'Could not update the user with a new check' });
                    }
                  });
                } else {
                  callback(500, { 'Error': 'Could not create the new check' });
                }
              })
            } else {
              callback(400, { 'Error': 'User already has the max number of checks (' + config.maxChecks + ')' });
            }
          } else {
            callback(403);
          }
        })
      } else {
        callback(403);
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required inputs, or inputs are invalid' });

  }
};

//Checks - get
//Required data : id
//Optional data : none
handlers._checks.get = function (data, callback) {
  //check that the id  is provided
  let id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the check
    _data.read('checks', id, function (err, checkData) {
      if (!err && checkData) {
        //Get the token from the headers
        let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        //Verify that the given toek is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
          if (tokenIsValid) {
            callback(200, checkData);
          } else {
            callback(403);

          }
        });
      } else {
        callback(400, { 'Error': 'Missing required field' });
      }
    });
  }
};

//Checks - put
//Required data: id
//Optional data: protocol, url, methods, successCodes, timeoutSeconds
handlers._checks.put = function (data, callback) {

  let id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  //Check for the optional fields
  let protocol = typeof (data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  let url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  let method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  let successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  let timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  if (id) {
    //Check to make sure on or more option fields has been sent
    if (protocol || url || method || successCodes || timeoutSeconds) {
      _data.read('checks', id, function (err, checkData) {
        if (!err && checkData) {
          //Get the token from the headers
          let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
          //Verify that the given toek is valid and belongs to the user who created the check
          handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
            if (tokenIsValid) {
              //Update the check where necessary
              if (protocol) {
                checkData.protocol = protocol;
              }

              if (method) {
                checkData.method = method;
              }

              if (url) {
                checkData.url = url;
              }

              if (successCodes) {
                checkData.successCodes = successCodes;
              }

              if (timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }
              //Store the updates
              _data.update('checks', id, checkData, function (err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, { 'Error': 'Could not update the check' });
                }
              });
            } else {
              callback(403);

            }
          });
        } else {
          callback(400, { 'Error': 'Check Id did not exist' });
        }
      })
    } else {

      callback(400, { 'Error': 'Missing fields to update' });
    }
  } else {
    callback(400, { 'Error': 'Missing required fields' });

  }
};
//Checks - delete
//Required data: id
//Optional data: none

handlers._checks.delete = function (data, callback) {
  //Check that the phone is valid
  let id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    //Lookup the check
    _data.read('checks', id, function (err, checkData) {
      if (!err && checkData) {
        let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
          if (tokenIsValid) {
            //Delete the check data
            _data.delete('checks', id, function (err) {
              if (!err) {
                //Look up the user
                _data.read('users', checkData.userPhone, function (err, userData) {

                  if (!err && userData) {
                    let userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                    //Remove the delete check from the list of check
                    let checkPosition = userChecks.indexOf(id);

                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);
                      //Save the user data
                      _data.update('users', checkData.userPhone, userData, function (err) {
                        if (!err) {
                          callback(200);
                        } else {
                          callback(500, { 'Error': 'Could not update the specified user' });
                        }
                      });
                    } else {
                      callback(500, { 'Error': 'Could not find the users check on the users object' });
                    }

                  } else {
                    callback(500, { 'Error': 'Could not find the specified user who created the check' });
                  }
                });
              } else {
                callback(500, { 'Error': 'could not delete the check data' });
              }
            });


          } else {

            callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
          }
        });
      } else {
        callback(400, { 'Error': 'check id does not exist' });
      }
    });


  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};
module.exports = handlers;