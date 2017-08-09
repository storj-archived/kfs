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
    this._offset = 0;
    this._head = null;
    this._tail = null;
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
      const k = (this._head.chunk.length - this._offset);
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
    const self = this;
    
    function _transformChunk() {
      const chunk = Buffer.allocUnsafe(self._chunkSize);
      var i = 0;
      var j = self._chunkSize;
      while (i < self._chunkSize) {
        const k = (self._head.chunk.length - self._offset);
        if (j >= k) {
          self._drainChunk(chunk, i);
          i += k;
          j -= k;
        } else {
          self._head.chunk.copy(chunk, i, self._offset, self._offset + j);
          self._offset += j;
          i += j;
        }
      }
      return chunk;
    }

    while (this._bufferLength >= this._chunkSize) {
      const chunk = _transformChunk();    
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
    if (this._tail === null) {
      this._head = entry;
    } else {
      this._tail.next = entry;
    }
    this._tail = entry;
    this._bufferLength += bytes.length;
  }

  /**
   * Completely drain one chunk
   * @private
   */
  _drainChunk(chunk, i) {
    this._head.chunk.copy(chunk, i, this._offset);
    this._offset = 0;
    if(this._head.next === null) {
      this._head = null;
      this._tail = null;
    } else {
      this._head = this._head.next;
    }
  }

}

module.exports = BlockStream;
