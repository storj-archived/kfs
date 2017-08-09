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
    this._bufferLength = 0;
    this._chunkOffset = 0;
    this._queueHead = null;
    this._queueTail = null;
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
    if(this._bufferLength === 0) {
      return callback(null);
    }
    const chunk = (this._addPadding && this._chunkSize !== this._bufferLength)
        ? Buffer.allocUnsafe(this._chunkSize).fill(0, this._bufferLength)
        : Buffer.allocUnsafe(this._bufferLength);

    var i = 0;
    while(this._bufferLength > 0) {
      const k = (this._queueHead.chunk.length - this._chunkOffset);
      this._drainChunk(chunk, i);
      i += k;
      this._bufferLength -= k;
    }
    this.push(chunk);
    callback(null);
  }

  /**
   * Drains the internal buffer
   * @private
   */
  _drainInternalBuffer() {
    while (this._bufferLength >= this._chunkSize) {
      const chunk = Buffer.allocUnsafe(this._chunkSize);
      var i = 0;
      var j = this._chunkSize;
      while (i < this._chunkSize) {
        const k = (this._queueHead.chunk.length - this._chunkOffset);
        if (j >= k) {
          this._drainChunk(chunk, i);
          i += k;
          j -= k;
        } else {
          this._queueHead.chunk.copy(chunk, i, this._chunkOffset, this._chunkOffset + j);
          this._chunkOffset += j;
          i += j;
        }          
      }
      this.push(chunk);
      this._bufferLength -= this._chunkSize;
    }
  }

  /**
   * Adds the bytes to the internal buffer
   * @private
   */
  _addToBuffer(bytes) {
    const entry = { chunk: bytes, next: null };
    if (this._queueTail === null) {
      this._queueHead = entry;
    } else {
      this._queueTail.next = entry;
    }
    this._queueTail = entry;
    this._bufferLength += bytes.length;
  }

  /**
   * Completely drain one chunk
   * @private
   */
  _drainChunk(chunk, i) {
    this._queueHead.chunk.copy(chunk, i, this._chunkOffset);
    this._chunkOffset = 0;
    if(this._queueHead.next === null) {
      this._queueHead = null;
      this._queueTail = null;
    } else {
      this._queueHead = this._queueHead.next;
    }
  }

}

module.exports = BlockStream;
