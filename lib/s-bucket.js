'use strict';

const merge = require('merge');
const leveldown = require('leveldown');
const {EventEmitter} = require('events');
const constants = require('./constants');
const utils = require('./utils');
const WritableFileStream = require('./write-stream');
const ReadableFileStream = require('./read-stream');
const BlockStream = require('./block-stream');
const async = require('async');

/**
 * Capped LevelDB database within a {@link Btable}
 */
class Sbucket extends EventEmitter {

  static get LOCKED() {
    return 5;
  }

  static get CLOSED() {
    return 4;
  }

  static get CLOSING() {
    return 3;
  }

  static get OPENED() {
    return 2;
  }

  static get OPENING() {
    return 1;
  }

  static get SIZE_START_KEY() {
    return '0';
  }

  static get SIZE_END_KEY() {
    return 'z';
  }

  static get DEFAULTS() {
    return {
      maxOpenFiles: 1000,
      compression: false,
      cacheSize: 8 * (1024 * 1024),
      createIfMissing: true,
      errorIfExists: false,
      writeBufferSize: 4 * (1024 * 1024),
      blockSize: 4096,
      blockRestartInterval: 16,
      maxSize: constants.S,
      chunkSize: constants.C
    };
  }

  /**
   * @constructor
   * @param {String} dbPath - The path to database on disk
   * @param {Object} [options] - Options to pass through to leveldown#open
   * @param {Number} [options.maxOpenFiles=1000]
   * @param {Boolean} [options.compression=false]
   * @param {Number} [options.cacheSize=8388608]
   * @param {Boolean} [options.createIfMissing=true]
   * @param {Boolean} [options.errorIfExists=false]
   * @param {Number} [options.writeBufferSize=4194304]
   * @param {Number} [options.blockSize=4096]
   * @param {Number} [options.blockRestartInterval=16]
   */
  constructor(dbPath, options) {
    super();
    this.setMaxListeners(Infinity);
    this._dbPath = dbPath;
    this._options = merge(Sbucket.DEFAULTS, options);
    this._db = leveldown(dbPath);
    this._pendingOperations = 0;
    this._maxSize = this._options.maxSize;
    this.readyState = Sbucket.CLOSED;
  }

  /**
   * Triggered when the underlying database opens
   * @event Sbucket#open
   */

  /**
   * Triggered when the underlying database closes
   * @event Sbucket#close
   */

  /**
   * Triggered when there are no more pending operations
   * @event Sbucket#idle
   */

  /**
   * Triggered when the bucket is locked for flushing
   * @event Sbucket#locked
   */

  /**
   * Triggered when the bucket is unlocked
   * @event Sbucket#unlocked
   */

  /**
   * Opens the underlying database
   * @fires Sbucket#open
   * @param {Sbucket~openCallback}
   */
  open(callback=utils.noop) {
    const self = this;

    if (this.readyState === Sbucket.LOCKED) {
      return callback(new Error('S-bucket is currently locked for flushing'));
    }

    function _open() {
      self.readyState = Sbucket.OPENING;
      self._db.open(self._options, function(err) {
        if (err) {
          return self.emit('error', err);
        }

        self.readyState = Sbucket.OPENED;
        self.emit('open');
      });
    }

    function _onError(err) {
      self.removeListener('open', _onOpen);
      callback(err);
    }

    function _onOpen() {
      self.removeListener('error', _onError);
      callback(null);
    }

    this.once('open', _onOpen).once('error', _onError);

    if (this.readyState === Sbucket.OPENED) {
      return this.emit('open');
    }

    if (this.readyState === Sbucket.OPENING) {
      return;
    }

    if (this.readyState === Sbucket.CLOSING) {
      return this.once('close', _open);
    }

    _open();
  }
  /**
   * @callback Sbucket~openCallback
   * @param {Error} [error]
   */

  /**
   * Closes the underlying database
   * @fires Sbucket#close
   * @param {Sbucket~closeCallback}
   */
  close(callback=utils.noop) {
    const self = this;

    function _close() {
      self.readyState = Sbucket.CLOSING;
      self._db.close(function(err) {
        if (err) {
          return self.emit('error', err);
        }

        self.readyState = Sbucket.CLOSED;
        self.emit('close');
      });
    }

    function _onError(err) {
      self.removeListener('close', _onClose);
      callback(err);
    }

    function _onClose() {
      self.removeListener('error', _onError);
      callback(null);
    }

    this.once('close', _onClose).once('error', _onError);

    if (this.readyState === Sbucket.CLOSED) {
      return this.emit('close');
    }

    if (this.readyState === Sbucket.CLOSING) {
      return;
    }

    if (this.readyState === Sbucket.OPENING) {
      return this.once('open', _close);
    }

    _close();
  }
  /**
   * @callback Sbucket~closeCallback
   * @param {Error} [error]
   */

  /**
   * Determines if the file is already stored in the db
   * @param {String} key - The key for the file stored
   * @param {Sbucket~existsCallback}
   */
  exists(key, callback) {
    this._incPendingOps();
    this._db.get(utils.createItemKeyFromIndex(key, 0), (err) => {
      this._decPendingOps();
      callback(null, !err);
    });
  }
  /**
   * @callback Sbucket~existsCallback
   * @param {Error} [error]
   * @param {Boolean} fileDoesExist
   */

  /**
   * Deletes the file chunks from the database
   * @param {String} key - The key for the file stored
   * @param {Sbucket~unlinkCallback}
   */
  unlink(key, callback) {
    const self = this;
    let index = 0;

    function _del(index, callback) {
      const itemKey = utils.createItemKeyFromIndex(key, index);

      self._db.get(itemKey, function(err) {
        index++;

        if (!err) {
          self._db.del(itemKey, () => _del(index, callback));
        } else if (utils.isNotFoundError(err)) {
          self._decPendingOps();
          callback(null);
        } else {
          self._decPendingOps();
          callback(err);
        }
      });
    }

    this._incPendingOps();
    _del(index, callback);
  }
  /**
   * @callback Sbucket~unlinkCallback
   * @param {Error} [error]
   */

  /**
   * Reads the file at the given key into a buffer
   * @param {String} key - The key for the file to read
   * @param {Sbucket~readFileCallback}
   */
  readFile(key, callback) {
    let fileBuffer = Buffer.from([], 'binary');
    const readStream = this.createReadStream(key);

    readStream.on('data', (data) => {
      fileBuffer = Buffer.concat([fileBuffer, data]);
    });

    readStream.on('end', () => {
      this._decPendingOps();
      callback(null, fileBuffer);
    });

    readStream.on('error', (err) => {
      this._decPendingOps();
      readStream.removeAllListeners();
      callback(err);
    });

    this._incPendingOps();
  }
  /**
   * @callback Sbucket~readFileCallback
   * @param {Error} [error]
   * @param {Buffer} fileBuffer
   */

  /**
   * Writes the buffer to the given key
   * @param {String} key - The key for the file to write
   * @param {Buffer} buffer - The data to write to the given key
   * @param {Sbucket~writeFileCallback}
   */
  writeFile(key, buffer, callback) {
    const self = this;
    const writeStream = this.createWriteStream(key);
    let whichSlice = 0;

    function _writeFileSlice() {
      var startIndex = whichSlice * self._options.chunkSize;
      var endIndex = startIndex + self._options.chunkSize;
      var bufferSlice = buffer.slice(startIndex, endIndex);

      if (bufferSlice.length === 0) {
        return writeStream.end();
      }

      whichSlice++;
      writeStream.write(bufferSlice);
      _writeFileSlice();
    }

    writeStream.on('finish', () => {
      this._decPendingOps();
      callback(null);
    });

    writeStream.on('error', (err) => {
      this._decPendingOps();
      writeStream.removeAllListeners();
      callback(err);
    });

    this._incPendingOps();
    this.unlink(key, _writeFileSlice);
  }
  /**
   * @callback Sbucket~writeFileCallback
   * @param {Error} [error]
   */

  /**
   * Returns a readable stream of the file at the given key
   * @param {String} key - The key for the file to read
   * @returns {ReadableFileStream}
   */
  createReadStream(key) {
    const rs = new ReadableFileStream({
      sBucket: this,
      fileKey: key
    });

    this._incPendingOps();
    rs.on('end', () => this._decPendingOps());

    return rs;
  }

  /**
   * Returns a writable stream for a file at the given key
   * @param {String} key - The key for the file to read
   * @returns {WritableFileStream}
   */
  createWriteStream(key) {
    const bs = new BlockStream({
      chunkSize: this._options.chunkSize,
      padLastChunk: false
    });
    const ws = new WritableFileStream({
      sBucket: this,
      fileKey: key
    });

    // NB: Expose the underyling writable stream's #destroy method
    bs.destroy = (cb) => ws.destroy(cb);

    this._incPendingOps();
    bs.pipe(ws).on('finish', () => this._decPendingOps());

    return bs;
  }

  /**
   * Get stats for this bucket
   * @param {Sbucket~statCallback}
   */
  stat(callback) {
    const [start, end] = [Sbucket.SIZE_START_KEY, Sbucket.SIZE_END_KEY];

    this._incPendingOps();
    this._db.approximateSize(start, end, (err, size) => {
      this._decPendingOps();

      if (err) {
        return callback(err);
      }

      callback(null, {
        size: size,
        free: this._maxSize - size
      });
    });
  }
  /**
   * @callback Sbucket~statCallback
   * @param {Error} [error]
   * @param {Object} bucketStats
   * @param {Number} bucketStats.size - The used space in bytes
   * @param {Number} bucketStats.free - The free space left in bytes
   */

  /**
   * Get a list of file keys in the bucket and their approximate size
   * @param {Sbucket~listCallback}
   */
  list(callback) {
    const self = this;
    const iterator = this._db.iterator({
      gte: Sbucket.SIZE_START_KEY,
      lte: Sbucket.SIZE_END_KEY,
      values: false,
      keyAsBuffer: false
    });
    const keys = {};
    let currentResult = null;

    function _test() {
      return currentResult === null;
    }

    function _accumulateKey(next) {
      iterator.next((err, key) => {
        if (err) {
          return next(err);
        }

        if (!key) {
          currentResult = null;
          return next();
        }

        currentResult = key.split(' ')[0];
        keys[currentResult] = keys[currentResult]
                            ? keys[currentResult] + self._options.chunkSize
                            : self._options.chunkSize;
        next();
      });
    }

    this._incPendingOps();
    async.doUntil(_accumulateKey, _test, (err) => {
      this._decPendingOps();

      if (err) {
        return callback(err);
      }

      var results = [];

      for (var key in keys) {
        results.push({
          baseKey: key,
          approximateSize: keys[key]
        });
      }

      callback(null, results);
    });
  }
  /**
   * @callback Sbucket~listCallback
   * @param {Error} [error]
   * @param {Object[]} results
   * @param {String} results.baseKey
   * @param {Number} results.approximateSize
   */

  /**
   * Wait for pending operations to complete, then close the database and
   * trigger a leveldown#repair to force compaction and resume normal operation
   * when finished
   * @param {Sbucket~flushCallback}
   */
  flush(callback) {
    async.series(
      [
        (next) => this._lock(next),
        (next) => leveldown.repair(this._dbPath, next),
        (next) => this._unlock(next)
      ],
      (err) => callback(err || null)
    );
  }
  /**
   * @callback Sbucket~flushCallback
   * @param {Error|null} error
   */

  /**
   * Wait for pending ops to complete, then close the database and lock it
   * @private
   * @param {Sbucket~_lockCallback}
   */
  _lock(callback) {
    if (this._pendingOperations !== 0) {
      const currentLock = this._lock.bind(this, callback);

      if (this._pendingLock) {
        this.removeListener('idle', this._pendingLock);
      }

      return this.once('idle', this._pendingLock = currentLock);
    }

    if (this.readyState === Sbucket.LOCKED) {
      return callback(new Error('S-bucket is already locked'));
    }

    this.close((err) => {
      if (err) {
        return callback(err);
      }

      this.readyState = Sbucket.LOCKED;

      this.emit('locked');
      callback(null);
    });
  }
  /**
   * @callback Sbucket~_lockCallback
   * @param {Error|null} error
   */

  /**
   * Reset the ready state to closed and re-open the database
   * @param {Sbucket~_unlockCallback}
   */
  _unlock(callback) {
    if (this.readyState !== Sbucket.LOCKED) {
      return callback(null);
    }

    this.readyState = Sbucket.CLOSED;

    this.emit('unlocked');
    callback(null);
  }
  /**
   * @callback Sbucket~_unlockCallback
   * @param {Error|null} error
   */

  /**
   * Increments the pending operations counter
   * @private
   */
  _incPendingOps() {
    this._pendingOperations++;
  }

  /**
   * Decrements the pending operations counter
   * @private
   * @fires Sbucket#idle
   */
  _decPendingOps() {
    this._pendingOperations--;
    setImmediate(() => this._checkIdleState());
  }

  /**
   * Emits the idle event if state is idle
   * @private
   */
  _emitIfStateIsIdle() {
    if (this._pendingOperations === 0) {
      this.emit('idle');
      return true;
    }

    return false;
  }

  /**
   * Checks the idle state and triggers a timeout for emitting the idle event
   * @private
   * @returns {Boolean} hasNoPendingOperations
   */
  _checkIdleState() {
    if (this._pendingOperations !== 0) {
      return false;
    }

    setTimeout(() => this._emitIfStateIsIdle(), constants.SBUCKET_IDLE);
    return true;
  }

}

module.exports = Sbucket;
