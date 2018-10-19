/*
* Library that demonstrates a library that throws an error when it's init() is called
*/

//Container for the module

const example = {};
example.init = () => {
  //This error is intentional
  let foo = bar;

};

module.exports = example;
