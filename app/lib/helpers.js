/*
* Helpers for various tasks
*
*/
// Dependencies
const crypto = require('crypto');
const config = require('./config');

//Contain for the helpers
let helpers = {};

//Create a SHA256 hash
helpers.hash = function(str){
  if(typeof(str) == 'string' && str.length > 0){
    let hash = crypto.createHmac('sha256',config.hashingSecret).update(str).digest('hex');
    return hash;
  }else{
    return false;
  }
};

//parse a json string to an object in all cases without throwing
helpers.parseJsonToObject = function(str){

  try{
    let obj = JSON.parse(str);
    return obj;
  }catch(e){
    return {};
  }
}

//Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function(strLength){
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
  if(strLength){
    //Define all the possible characters that could go into a string 
    let possibleCharacters = 'abcdefghijklmnopqrstuvwxyz1234567890';

    //Start the final string 
    let str = '';
    for(i = 1; i <= strLength; i++){
      //Get a random char from chars string
      let randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));

      //Append this char to the final string 
      str+=randomCharacter;
    }
    return str;

  }else{
    return false;
  }
}


//Export the module
module.exports = helpers;
