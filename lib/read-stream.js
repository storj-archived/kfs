'use strict';

const {Readable: ReadableStream} = require('readable-stream').Readable;
const utils = require('./utils');

/**
 * Creates a readable stream of a file from a {@link Sbucket}
 */
class ReadableFileStream extends ReadableStream {

  /**
   * @constructor
   * @param {Object} options
   * @param {Sbucket} options.sBucket
   * @param {String} options.fileKey
   */
  constructor(options) {
    super();
    this._sBucket = options.sBucket;
    this._fileKey = options.fileKey;
    this._index = 0;
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

  /**
   * @private
   */
  _read() {
    const itemKey = utils.createItemKeyFromIndex(this._fileKey, this._index);

    this._sBucket._db.get(itemKey, (err, result) => {
      if (err) {
        if (utils.isNotFoundError(err)) {
          return this.push(null);
        } else {
          return this.emit('error', err);
        }
      }

      this._index++;
      this.push(Buffer(result, 'binary'));
    });
  }

  /**
   * Destroys and aborts any reads for this stream
   * @param {Sbucket~unlinkCallback}
   */
  destroy(callback) {
    this._sBucket.unlink(this._fileKey, callback);
  }

}

module.exports = ReadableFileStream;
