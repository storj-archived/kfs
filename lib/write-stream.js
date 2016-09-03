'use strict';

var inherits = require('util').inherits;
var WritableStream = require('readable-stream').Writable;
var utils = require('./utils');

/**
 * Creates a writable stream for storing a file in an {@link Sbucket}
 * @constructor
 * @param {Object} options
 * @param {Sbucket} options.sBucket - The S-bucket this stream will write to
 * @param {String} options.fileKey - The key for the file to write to
 */
function WritableFileStream(options) {
  if (!(this instanceof WritableFileStream)) {
    return new WritableFileStream(options);
  }

  this._sBucket = options.sBucket;
  this._fileKey = options.fileKey;
  this._index = 0;

  WritableStream.call(this);
}

/**
 * Triggered if an error occurs
 * @event WritableFileStream#error
 * @param {Error} error
 */

/**
 * Triggered when data is finished writing
 * @event WritableFileStream#finish
 */

inherits(WritableFileStream, WritableStream);

/**
 * @private
 */
WritableStream.prototype._write = function(bytes, encoding, callback) {
  var self = this;

  this._sBucket._db.put(
    utils.createItemKeyFromIndex(this._fileKey, this._index),
    bytes,
    function(err) {
      if (err) {
        return callback(err);
      }

      self._index++;
      callback();
    }
  );
};

/**
 * Destroys and aborts any writes for this stream
 * @param {Sbucket~unlinkCallback}
 */
WritableFileStream.prototype.destroy = function(callback) {
  this._sBucket.unlink(this._fileKey, callback);
};

module.exports = WritableFileStream;
