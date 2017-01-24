'use strict';

const {Writable: WritableStream} = require('readable-stream');
const utils = require('./utils');

/**
 * Creates a writable stream for storing a file in an {@link Sbucket}
 */
class WritableFileStream extends WritableStream {

  /**
   * @constructor
   * @param {Object} options
   * @param {Sbucket} options.sBucket - The S-bucket this stream will write to
   * @param {String} options.fileKey - The key for the file to write to
   */
  constructor(options) {
    super();
    this._sBucket = options.sBucket;
    this._fileKey = options.fileKey;
    this._index = 0;
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

  /**
   * @private
   */
  _write(bytes, encoding, callback) {
    const itemKey = utils.createItemKeyFromIndex(this._fileKey, this._index);

    this._sBucket._db.put(itemKey, bytes, (err) => {
      if (err) {
        return callback(err);
      }

      this._index++;
      callback();
    });
  }

  /**
   * Destroys and aborts any writes for this stream
   * @param {Sbucket~unlinkCallback}
   */
  destroy(callback) {
    this._sBucket.unlink(this._fileKey, callback);
  }

}

module.exports = WritableFileStream;
