/*
* Frontend logic for the application
*/
// Container for the front end application
const app = {};

//Config
app.config = {
  'sessionToken': false
};

//AJAX client for the rest API

app.client = {};

app.client.request = (headers, path, method, queryStringObject, payload, callback) => {
  headers = typeof (headers) == 'object' && headers !== null ? headers : {};
  path = typeof (path) == 'string' ? path : '/';
  method = typeof (method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method) > -1 ? method.toUpperCase() : 'GET';
  queryStringObject = typeof (queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
  payload = typeof (payload) == 'object' && payload !== null ? payload : {};
  callback = typeof (callback) == 'function' ? callback : false;

  //for each querystring param sent, add it to the path.
  let requestUrl = path + '?';
  let counter = 0;
  for (let queryKey in queryStringObject) {
    if (queryStringObject.hasOwnProperty(queryKey)) {
      counter++;
      //if at least one query string param has already been added, prepen new one with &
      if (counter > 1) {
        requestUrl += '&';
      }
      requestUrl += queryKey + '=' + queryStringObject[queryKey];
    }
  }
  // form the http request as a JSON type
  let xhr = new XMLHttpRequest();
  xhr.open(method, requestUrl, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  //for each header send ,add it to the request
  for (let headerKey in headers) {
    if (headers.hasOwnProperty(headerKey)) {
      xhr.setRequestHeader(headerKey, headers[headerKey]);
    }
  }

  // If ther eis a current session tokenset, add that as a header
  if (app.config.sessionToken) {
    xhr.setRequestHeader("token", app.config.sessionToken.id);
  }
  // When the request comes back, handle the response
  xhr.onreadystatechange = () => {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      let statusCode = xhr.status;
      let responseReturned = xhr.responseText;

      // callback if requested
      if (callback) {
        try {
          let parsedResponse = JSON.parse(responseReturned);
          callback(statusCode, parsedResponse);
        } catch (e) {
          callback(false);
        }
      }
    }
  }


  //Send the payload as JSON
  let payloadString = JSON.stringify(payload);
  xhr.send(payloadString);
};