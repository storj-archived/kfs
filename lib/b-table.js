'use strict';

const merge = require('merge');
const {EventEmitter} = require('events');
const fs = require('fs');
const mkdirp = require('mkdirp');
const utils = require('./utils');
const constants = require('./constants');
const Sbucket = require('./s-bucket');
const path = require('path');
const assert = require('assert');
const async = require('async');


/**
 * Represents the primary interface for the KFS file store
 */
class Btable extends EventEmitter {

  static get RID_FILENAME() {
    return 'r.id';
  }

  static get DEFAULTS() {
    return {
      referenceId: null,
      maxTableSize: constants.S * constants.B,
      sBucketOpts: {}
    };
  }

  /**
   * Constructs series of {@link Sbucket}s composing a sharded table
   * @constructor
   * @param {String} tablePath - The path to the directory to store the table
   * @param {Object} [options]
   * @param {String} [options.referenceId] - R bit hex reference ID
   * @param {Number} [options.maxTableSize] - Max bytes to cap the database
   * @param {Object} [options.sBucketOpts] - Options to pass to Sbucket
   */
  constructor(tablePath, options) {
    super();

    this._options = merge(Btable.DEFAULTS, options);
    this._rid = utils.createReferenceId(this._options.referenceId);
    this._sBuckets = {};
    this._tablePath = utils.coerceTablePath(tablePath);
    this._maxTableSize = this._options.maxTableSize;
    this._options.sBucketOpts.maxSize = this._maxTableSize / constants.B;

    this._open();
  }

  /**
   * Opens the Btable, creating it if it does not exist
   * @private
   */
  _open() {
    if (!utils.fileDoesExist(this._tablePath)) {
      this._initBtableDirectory();
    } else {
      this._validateTablePath();
    }

    this._rid = Buffer(fs.readFileSync(
      path.join(this._tablePath, Btable.RID_FILENAME),
      { encoding: 'hex' }
    ), 'hex');
  }

  /**
   * Initializes a new KFS database (B-table directory)
   * @private
   */
  _initBtableDirectory() {
    mkdirp.sync(this._tablePath);
    fs.writeFileSync(
      path.join(this._tablePath, Btable.RID_FILENAME),
      this._rid,
      { encoding: 'hex' }
    );
  }

  /**
   * Validates a path to a directory as a KFS instance
   * @private
   */
  _validateTablePath() {
    const dirStats = fs.statSync(this._tablePath);

    assert(dirStats.isDirectory(), 'Table path is not a directory');

    const requiredPaths = [Btable.RID_FILENAME];
    const dirContents = fs.readdirSync(this._tablePath);

    for (let pathName of requiredPaths) {
      assert(dirContents.indexOf(pathName) !== -1,
             'Table path is not a valid KFS instance');
    }
  }

  /**
   * Determine the {@link Sbucket} index for a given key
   * @private
   * @param {String} key - The data key to route
   * @returns {Number}
   */
  _getSbucketIndexForKey(key) {
    return this._rid[0] ^ Buffer(utils.hashKey(key), 'hex')[0];
  }

  /**
   * Get the {@link Sbucket} for the supplied index
   * @private
   * @param {Number} sBucketIndex - The index for the desired bucket
   * @returns {Sbucket}
   */
  _getSbucketAtIndex(sBucketIndex) {
    assert(sBucketIndex < constants.B, 'Index must not be greater than B');
    assert(sBucketIndex > -1, 'Index must be greater than or equal to 0');

    if (this._sBuckets[sBucketIndex]) {
      return this._sBuckets[sBucketIndex];
    }

    this._sBuckets[sBucketIndex] = new Sbucket(
      path.join(this._tablePath,
                utils.createSbucketNameFromIndex(sBucketIndex)),
      this._options.sBucketOpts
    );

    this._sBuckets[sBucketIndex].removeAllListeners('idle');
    this._sBuckets[sBucketIndex].once('idle', () => {
      this._sBuckets[sBucketIndex].close();
    });

    return this._sBuckets[sBucketIndex];
  }

  /**
   * Get the {@link Sbucket} for the given key
   * @private
   * @param {String} key - The key that maps to a {@link Sbucket}
   * @param {Btable~_getSbucketForKeyCallback}
   */
  _getSbucketForKey(key, callback) {
    const sIndex = typeof key === 'number'
                 ? key
                 : this._getSbucketIndexForKey(key);
    const sBucket = this._getSbucketAtIndex(sIndex);

    if (sBucket.readyState !== Sbucket.OPENED) {
      return sBucket.open((err) => {
        if (err) {
          return callback(err);
        }

        callback(null, sBucket, sIndex);
      });
    }

    callback(null, sBucket, sIndex);
  }
  /**
   * @private
   * @callback Btable~_getSbucketForKeyCallback
   * @param {Error} [error]
   * @param {Sbucket} sBucket
   */

  /**
   * Lists the created {@link Sbucket}s and their sizes
   * @param {String|Number} [keyOrIndex] - Optional bucket index or file key
   * @param {Btable~statCallback}
   */
  stat(keyOrIndex, callback) {
    const self = this;

    if (typeof keyOrIndex === 'function') {
      callback = keyOrIndex;
      keyOrIndex = null;
    }

    if (keyOrIndex) {
      return _getStat(keyOrIndex, (err, stats) => {
        callback(err, stats ? [stats] : undefined);
      });
    }

    let sBuckets = fs.readdirSync(this._tablePath)
      .filter((name) => name !== Btable.RID_FILENAME)
      .map((sBucketName) => parseInt(sBucketName))
      .filter((sBucketIndex) => {
        return !Number.isNaN(sBucketIndex) && typeof sBucketIndex === 'number';
      });

    function _getStat(sBucketIndex, done) {
      self._getSbucketForKey(sBucketIndex, (err, sBucket, sIndex) => {
        if (err) {
          return done(err);
        }

        sBucket.stat((err, stats) => {
          if (err) {
            return done(err);
          }

          done(null, {
            sBucketIndex: sIndex,
            sBucketStats: stats
          });
        });
      });
    }

    async.mapLimit(sBuckets, 3, _getStat, callback);
  }
  /**
   * @callback Btable~statCallback
   * @param {Error} [error]
   * @param {Object[]} sBuckets
   * @param {String} sBuckets[].sBucketIndex - The index of the S-bucket
   * @param {Object} sBuckets[].sBucketStats
   * @param {Number} sBuckets[].sBucketStats.used - Space used in the bucket
   * @param {Number} sBuckets[].sBucketStats.free - Space free in the bucket
   */

  /**
   * Lists the file keys in the given bucket
   * @param {Number|String} keyOrIndex - The bucket index of a file key
   * @param {Sbucket~listCallback}
   */
  list(keyOrIndex, callback) {
    var key = typeof keyOrIndex === 'number'
            ? keyOrIndex
            : utils.coerceKey(keyOrIndex);

    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      sBucket.list(callback);
    });
  }

  /**
   * Check if a file exists at the supplied key
   * @param {String} key - The key to check for existence
   * @param {Sbucket~existsCallback}
   */
  exists(key, callback) {
    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      sBucket.exists(key, callback);
    });
  }

  /**
   * Unlinks the data for the given key
   * @param {String} key - The key to unlink data from
   * @param {Sbucket~unlinkCallback}
   */
  unlink(key, callback) {
    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      sBucket.unlink(key, callback);
    });
  }

  /**
   * Performs a flush on each S-bucket in the table to free any dead space
   * @param {Btable~flushCallback}
   */
  flush(callback) {
    async.eachSeries(Object.keys(this._sBuckets), (k, next) => {
      this._getSbucketForKey(parseInt(k), (err, sBucket) => {
        sBucket.flush(next);
      });
    }, callback);
  }
  /**
   * @callback Btable~flushCallback
   * @param {Error|null} error
   */

  /**
   * Reads the data at the supplied key into a buffer
   * @param {String} key - The key for the data to read
   * @param {Sbucket~readFileCallback}
   */
  readFile(key, callback) {
    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      sBucket.readFile(key, callback);
    });
  }

  /**
   * Creates a readable stream of the data at the given key
   * @param {String} key - The key for the data read
   * @param {Btable~createReadStreamCallback}
   */
  createReadStream(key, callback) {
    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      callback(null, sBucket.createReadStream(key));
    });
  }
  /**
   * @callback Btable~createReadStreamCallback
   * @param {Error} [error]
   * @param {ReadableStream} readStream
   */

  /**
   * Writes the given buffer to the key
   * @param {String} key - The key to write the data to
   * @param {Buffer} buffer - The raw buffer to write to the key
   * @param {Sbucket~writeFileCallback}
   */
  writeFile(key, buffer, callback) {
    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      sBucket.writeFile(key, buffer, callback);
    });
  }

  /**
   * Creates a writable stream to the given key
   * @param {String} key - The key to write the data to
   * @param {Btable~createWriteStreamCallback}
   */
  createWriteStream(key, callback) {
    this._getSbucketForKey(key, (err, sBucket) => {
      if (err) {
        return callback(err);
      }

      callback(null, sBucket.createWriteStream(key));
    });
  }
  /**
   * @callback Btable~createWriteStreamCallback
   * @param {Error} [error]
   * @param {WritableStream} writeStream
   */

}

module.exports = Btable;
