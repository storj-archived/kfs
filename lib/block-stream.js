'use strict';

const {Transform: TransformStream} = require('readable-stream');
const merge = require('merge');

/**
 * Transforms the input stream into an output stream of N-sized chunks
 */
class BlockStream extends TransformStream {

  static get DEFAULTS() {
    return {
      padLastChunk: false
    };
  }

  /**
   * @constructor
   * @param {Object} [options]
   * @param {Sbucket} [options.sBucket] - The S-bucket for chunks allocation
   * @param {Boolean} [options.padLastChunk=false] - Pad last chunk with zeros
   */
  constructor(options) {
    super();
    options = merge(BlockStream.DEFAULTS, options);
    this._addPadding = options.padLastChunk;
    this._bufferLength = 0;
    this._offset = 0;
    this._inputQueue = [];
    this._sBucket = options.sBucket;
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
    const chunk = (this._addPadding &&
                   this._sBucket._chunkSize !== this._bufferLength)
        ? ((this._sBucket._chunkFree.length > 0)
          ? this._sBucket._chunkFree.shift()
          : Buffer.allocUnsafe(this._sBucket._chunkSize))
          .fill(0, this._bufferLength)
        : Buffer.allocUnsafe(this._bufferLength);

    var i = 0;
    while(this._bufferLength > 0) {
      const input = this._inputQueue.shift();
      const k = (input.length - this._offset);
      input.copy(chunk, i, this._offset);
      this._offset = 0;
      i += k;
      this._bufferLength -= k;
    }
    this.push(chunk);
    this._sBucket._chunkFree.splice(0, this._sBucket._chunkFree.length);
    callback(null);
  }

  /**
   * Drains the internal buffer
   * @private
   */
  _drainInternalBuffer() {
    const self = this;

    function _transformChunk(chunk, j) {
      var i = 0;
      while (i < self._sBucket._chunkSize) {
        const input = self._inputQueue.shift();
        const k = (input.length - self._offset);
        if (j >= k) {
          input.copy(chunk, i, self._offset);
          self._offset = 0;
          i += k;
          j -= k;
        } else {
          input.copy(chunk, i, self._offset, self._offset + j);
          self._inputQueue.unshift(input);
          self._offset += j;
          i += j;
        }
      }
    }

    while (this._bufferLength >= this._sBucket._chunkSize) {
      const chunk = (this._sBucket._chunkFree.length > 0)
          ? this._sBucket._chunkFree.shift()
          : Buffer.allocUnsafe(this._sBucket._chunkSize);
      _transformChunk(chunk, this._sBucket._chunkSize);
      this.push(chunk);
      this._bufferLength -= this._sBucket._chunkSize;
    }
  }

  /**
   * Adds the bytes to the internal buffer
   * @private
   */
  _addToBuffer(bytes) {
    this._inputQueue.push(bytes);
    this._bufferLength += bytes.length;
  }

}

module.exports = BlockStream;
