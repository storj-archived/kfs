'use strict';

var inherits = require('util').inherits;
var ReadableStream = require('readable-stream').Readable;
var utils = require('./utils');

/**
 * Creates a readable stream of a file from a {@link Sbucket}
 * @constructor
 * @param {Object} options
 * @param {Sbucket} options.sBucket
 * @param {String} options.fileKey
 */
function ReadableFileStream(options) {
  if (!(this instanceof ReadableFileStream)) {
    return new ReadableFileStream(options);
  }

  this._sBucket = options.sBucket;
  this._fileKey = options.fileKey;
  this._index = 0;

  ReadableStream.call(this);
}

/**
 * Triggered when data is available to read
 * @event ReadableFileStream#readable
 */

/**
 * Triggered when a data is pushed through the stream
 * @event ReadableFileStream#data
 * @param {Buffer} bytes
 */

/**
 * Triggered when no more data is available
 * @event ReadableFileStream#end
 */

/**
 * Triggered if an error occurs
 * @event ReadableFileStream#error
 * @param {Error} error
 */

inherits(ReadableFileStream, ReadableStream);

/**
 * @private
 */
ReadableFileStream.prototype._read = function() {
  var self = this;

  this._sBucket._db.get(
    utils.createItemKeyFromIndex(this._fileKey, this._index),
    function(err, result) {
      if (err) {
        if (utils.isNotFoundError(err)) {
          return self.push(null);
        } else {
          return self.emit('error', err);
        }
      }

      self._index++;
      self.push(Buffer(result, 'binary'));
    }
  );
};

/**
 * Destroys and aborts any reads for this stream
 * @param {Sbucket~unlinkCallback}
 */
ReadableFileStream.prototype.destroy = function(callback) {
  this._sBucket.unlink(this._fileKey, callback);
};

module.exports = ReadableFileStream;
