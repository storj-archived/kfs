/**
 * @module kfs/utils
 */

'use strict';

var assert = require('assert');
var constants = require('./constants');

/**
 * A stubbed noop function
 */
module.exports.noop = function() {};

/**
 * Get the key name for a data hash + index
 * @param {String} key - Hash of the data
 * @param {Number} index - The index of the file chunk
 * @returns {String}
 */
module.exports.createItemKeyFromIndex = function(key, index) {
  assert(typeof index === 'number', 'Invalid index supplied');

  var indexLength = Math.floor(constants.S / constants.C).toString().length;
  var indexString = index.toString();
  var itemIndex = '';

  assert(Buffer(key, 'hex').length * 8 === constants.B, 'Invalid key length');
  assert(indexString.length <= indexLength, 'Index is out of bounds');

  for (var i = 0; i < indexLength - indexString.length; i++) {
    itemIndex += '0';
  }

  itemIndex += indexString;

  return [key, ' ', itemIndex].join('');
};
