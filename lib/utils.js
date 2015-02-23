'use strict';
var util = require('util');

var utils = module.exports;

utils.assert = function assert(val, msg) {
  if (!val){
    throw new Error(msg || 'Assertion failed');
  }
}

utils.assert.equal = function assertEqual(l, r, msg) {
  if (l != r) {
    throw new Error(msg || ('Assertion failed: ' + l + ' != ' + r));
  }
};

utils.inherits = util.inherits;
