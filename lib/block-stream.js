'use strict';

const {Transform: TransformStream} = require('readable-stream');
const constants = require('./constants');
const merge = require('merge');


/**
 * Transforms the input stream into an output stream of N-sized chunks
 */
class BlockStream extends TransformStream {

  static get DEFAULTS() {
    return {
      chunkSize: constants.C,
      padLastChunk: false
    };
  }

  /**
   * @constructor
   * @param {Object} [options]
   * @param {Number} [options.chunkSize=constants.C] - The bytes of each chunk
   * @param {Boolean} [options.padLastChunk=false] - Pad last chunk with zeros
   */
  constructor(options) {
    super();
    options = merge(BlockStream.DEFAULTS, options);
    this._chunkSize = options.chunkSize;
    this._addPadding = options.padLastChunk;
    this._currentBuffer = new Buffer([]);
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

  /**
   * Implements the transform method
   * @private
   */
  _transform(bytes, encoding, callback) {
    this._addToBuffer(bytes);
    this._drainInternalBuffer();
    callback(null);
  }

  /**
   * Implements the flush method
   * @private
   */
  _flush(callback) {
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
  }

  /**
   * Drains the internal buffer
   * @private
   */
  _drainInternalBuffer() {
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
  }

  /**
   * Adds the bytes to the internal buffer
   * @private
   */
  _addToBuffer(bytes) {
    this._currentBuffer = Buffer.concat([this._currentBuffer, bytes]);
  }

}

module.exports = BlockStream;
