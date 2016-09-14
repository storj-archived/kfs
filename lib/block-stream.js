'use strict';

var stream = require('readable-stream');
var inherits = require('util').inherits;
var constants = require('./constants');
var merge = require('merge');

/**
 * Transforms the input stream into an output stream of N-sized chunks
 * @constructor
 * @param {Object} [options]
 * @param {Number} [options.chunkSize=constants.C] - The bytes of each chunk
 * @param {Boolean} [options.padLastChunk=false] - Pad the last chunk with zeros
 */
function BlockStream(options) {
  if (!(this instanceof BlockStream)) {
    return new BlockStream(options);
  }

  options = merge(Object.create(BlockStream.DEFAULTS), options);

  this._chunkSize = options.chunkSize;
  this._addPadding = options.padLastChunk;
  this._currentBuffer = new Buffer([]);

  stream.Transform.call(this);
}

/**
 * Triggered when data is available
 * @event BlockStream#data
 * @param {Buffer} chunk
 */

/**
 * Triggered when the stream is ended
 * @event BlockStream#end
 */

BlockStream.DEFAULTS = {
  chunkSize: constants.C,
  padLastChunk: false
};

inherits(BlockStream, stream.Transform);

/**
 * Implements the transform method
 * @private
 */
BlockStream.prototype._transform = function(bytes, encoding, callback) {
  this._addToBuffer(bytes);
  this._drainInternalBuffer();
  callback(null);
};

/**
 * Implements the flush method
 * @private
 */
BlockStream.prototype._flush = function(callback) {
  if (this._currentBuffer.length === 0) {
    return callback(null);
  }

  if (this._addPadding) {
    this._addToBuffer(
      Buffer(this._chunkSize - this._currentBuffer.length).fill(0)
    );
  }

  this.push(this._currentBuffer);
  this._currentBuffer = Buffer([]);
  callback(null);
};

/**
 * Drains the internal buffer
 * @private
 */
BlockStream.prototype._drainInternalBuffer = function() {
  if (this._currentBuffer.length < this._chunkSize) {
    return;
  }

  var fullSlices = Math.floor(this._currentBuffer.length / this._chunkSize);
  var pushSlices = 0;

  while (pushSlices < fullSlices) {
    this.push(this._currentBuffer.slice(0, this._chunkSize));
    this._currentBuffer = this._currentBuffer.slice(this._chunkSize);
    pushSlices++;
  }
};

/**
 * Adds the bytes to the internal buffer
 * @private
 */
BlockStream.prototype._addToBuffer = function(bytes) {
  this._currentBuffer = Buffer.concat([this._currentBuffer, bytes]);
};

module.exports = BlockStream;
