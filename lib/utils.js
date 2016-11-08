/**
 * @module kfs/utils
 */

'use strict';

var assert = require('assert');
var constants = require('./constants');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

/**
 * A stubbed noop function
 */
module.exports.noop = function() {};

/**
 * Tests if the string is a valid key
 * @param {String} key - The file key
 * @returns {Boolean}
 */
module.exports.isValidKey = function(key) {
  var keyBuffer;

  try {
    keyBuffer = Buffer(key, 'hex');
  } catch (err) {
    return false;
  }

  return keyBuffer.length === (constants.R / 8);
};

/**
 * Hashes the given key
 * @param {String} key - The file key
 * @returns {String}
 */
module.exports.hashKey = function(key) {
  if (module.exports.isValidKey(key)) {
    return key;
  }

  return crypto.createHash(constants.HASH).update(key).digest('hex');
};

/**
 * Coerces input into a valid file key
 * @param {String} key - The file key
 * @returns {String}
 */
module.exports.coerceKey = function(key) {
  if (!module.exports.isValidKey(key)) {
    return module.exports.hashKey(key);
  }

  return key;
};

/**
 * Get the key name for a data hash + index
 * @param {String} key - Hash of the data
 * @param {Number} index - The index of the file chunk
 * @returns {String}
 */
module.exports.createItemKeyFromIndex = function(key, index) {
  assert(typeof index === 'number', 'Invalid index supplied');

  var fileKey = module.exports.hashKey(key);
  var indexLength = Math.floor(constants.S / constants.C).toString().length;
  var indexString = index.toString();
  var itemIndex = '';

  assert(Buffer(fileKey, 'hex').length * 8 === constants.R, 'Invalid key');
  assert(indexString.length <= indexLength, 'Index is out of bounds');

  for (var i = 0; i < indexLength - indexString.length; i++) {
    itemIndex += '0';
  }

  itemIndex += indexString;

  return [fileKey, ' ', itemIndex].join('');
};

/**
 * Get the file name of an s bucket based on it's index
 * @param {Number} sBucketIndex - The index fo the bucket in the B-table
 * @returns {String}
 */
module.exports.createSbucketNameFromIndex = function(sBucketIndex) {
  assert(typeof sBucketIndex === 'number', 'Invalid index supplied');

  var indexLength = constants.B.toString().length;
  var indexString = sBucketIndex.toString();
  var leadingZeroes = '';

  for (var i = 0; i < indexLength - indexString.length; i++) {
    leadingZeroes += '0';
  }

  return leadingZeroes + indexString + '.s';
};

/**
 * Creates a random reference ID
 * @param {String} [rid] - An existing hex reference ID
 * @returns {String}
 */
module.exports.createReferenceId = function(rid) {
  if (!rid) {
    rid = crypto.randomBytes(constants.R / 8).toString('hex');
  }

  assert(rid.length === 40, 'Invalid reference ID length');

  return Buffer(rid, 'hex');
};

/**
 * Check if the given path exists
 * @param {String} filePath
 * @returns {Boolean}
 */
module.exports.fileDoesExist = function(filePath) {
  try {
    fs.statSync(filePath);
  } catch (err) {
    return false;
  }

  return true;
};

/**
 * Takes a number of bytes and outputs a human readable size
 * @param {Number} bytes - The number of bytes to make readable
 * @returns {String}
 */
module.exports.toHumanReadableSize = function(bytes) {
  var thresh = 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  var units = ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
  var u = -1;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);

  return bytes.toFixed(1) + ' ' + units[u];
};

/**
 * Ensures that the given path has a kfs extension
 * @param {String} tablePath - The path name to a kfs instance
 * @returns {String}
 */
module.exports.coerceTablePath = function(tablePath) {
  if (path.extname(tablePath) !== '.kfs') {
    return tablePath + '.kfs';
  }

  return tablePath;
};

/**
 * Determines if the passed error object is a NotFound error
 * @param {Error} error
 * @returns {Boolean}
 */
module.exports.isNotFoundError = function(error) {
  return error && error.message.indexOf('NotFound:') !== -1;
};
