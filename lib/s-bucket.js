'use strict';

var merge = require('merge');
var leveldown = require('leveldown');
var inherits = require('util').inherits;
var events = require('events');
var constants = require('./constants');
var utils = require('./utils');
var WritableFileStream = require('./write-stream');
var ReadableFileStream = require('./read-stream');
var BlockStream = require('./block-stream');
var async = require('async');

/**
 * Capped LevelDB database within a {@link Btable}
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
function Sbucket(dbPath, options) {
  if (!(this instanceof Sbucket)) {
    return new Sbucket(dbPath, options);
  }

  events.EventEmitter.call(this);
  this.setMaxListeners(Infinity);

  this._dbPath = dbPath;
  this._options = merge(Object.create(Sbucket.DEFAULTS), options);
  this._db = leveldown(dbPath);
  this._pendingOperations = 0;
  this._maxSize = this._options.maxSize;
  this.readyState = Sbucket.CLOSED;
}

inherits(Sbucket, events.EventEmitter);

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

Sbucket.CLOSED = 4;
Sbucket.CLOSING = 3;
Sbucket.OPENED = 2;
Sbucket.OPENING = 1;
Sbucket.SIZE_START_KEY = '0';
Sbucket.SIZE_END_KEY = 'z';
Sbucket.DEFAULTS = {
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

/**
 * Opens the underlying database
 * @fires Sbucket#open
 * @param {Sbucket~openCallback}
 */
Sbucket.prototype.open = function(callback) {
  var self = this;
  callback = callback || utils.noop;

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
    return self.emit('open');
  }

  if (this.readyState === Sbucket.OPENING) {
    return;
  }

  if (this.readyState === Sbucket.CLOSING) {
    return self.once('close', _open);
  }

  _open();
};
/**
 * @callback Sbucket~openCallback
 * @param {Error} [error]
 */

/**
 * Closes the underlying database
 * @fires Sbucket#close
 * @param {Sbucket~closeCallback}
 */
Sbucket.prototype.close = function(callback) {
  var self = this;
  callback = callback || utils.noop;

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
    return self.emit('close');
  }

  if (this.readyState === Sbucket.CLOSING) {
    return;
  }

  if (this.readyState === Sbucket.OPENING) {
    return this.once('open', _close);
  }

  _close();
};
/**
 * @callback Sbucket~closeCallback
 * @param {Error} [error]
 */

/**
 * Determines if the file is already stored in the db
 * @param {String} key - The key for the file stored
 * @param {Sbucket~existsCallback}
 */
Sbucket.prototype.exists = function(key, callback) {
  var self = this;

  this._incPendingOps();
  this._db.get(utils.createItemKeyFromIndex(key, 0), function(err) {
    self._decPendingOps();
    callback(null, !err);
  });
};
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
Sbucket.prototype.unlink = function(key, callback) {
  var self = this;
  var index = 0;

  function _del(index, callback) {
    var itemKey = utils.createItemKeyFromIndex(key, index);

    self._db.get(itemKey, function(err) {
      index++;

      if (!err) {
        self._db.del(itemKey, function() {
          _del(index, callback);
        });
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
};
/**
 * @callback Sbucket~unlinkCallback
 * @param {Error} [error]
 */

/**
 * Reads the file at the given key into a buffer
 * @param {String} key - The key for the file to read
 * @param {Sbucket~readFileCallback}
 */
Sbucket.prototype.readFile = function(key, callback) {
  var self = this;
  var fileBuffer = new Buffer([], 'binary');
  var readStream = this.createReadStream(key);

  readStream.on('data', function(data) {
    fileBuffer = Buffer.concat([fileBuffer, data]);
  });

  readStream.on('end', function() {
    self._decPendingOps();
    callback(null, fileBuffer);
  });

  readStream.on('error', function(err) {
    self._decPendingOps();
    readStream.removeAllListeners();
    callback(err);
  });

  this._incPendingOps();
};
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
Sbucket.prototype.writeFile = function(key, buffer, callback) {
  var self = this;
  var writeStream = this.createWriteStream(key);
  var whichSlice = 0;

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

  writeStream.on('finish', function() {
    self._decPendingOps();
    callback(null);
  });

  writeStream.on('error', function(err) {
    self._decPendingOps();
    writeStream.removeAllListeners();
    callback(err);
  });

  this._incPendingOps();
  this.unlink(key, _writeFileSlice);
};
/**
 * @callback Sbucket~writeFileCallback
 * @param {Error} [error]
 */

/**
 * Returns a readable stream of the file at the given key
 * @param {String} key - The key for the file to read
 * @returns {ReadableFileStream}
 */
Sbucket.prototype.createReadStream = function(key) {
  var rs = new ReadableFileStream({
    sBucket: this,
    fileKey: key
  });

  this._incPendingOps();
  rs.on('end', this._decPendingOps.bind(this));

  return rs;
};

/**
 * Returns a writable stream for a file at the given key
 * @param {String} key - The key for the file to read
 * @returns {WritableFileStream}
 */
Sbucket.prototype.createWriteStream = function(key) {
  var bs = new BlockStream({
    chunkSize: this._options.chunkSize,
    padLastChunk: false
  });
  var ws = new WritableFileStream({
    sBucket: this,
    fileKey: key
  });

  // NB: Expose the underyling writable stream's #destroy method
  bs.destroy = ws.destroy.bind(ws);

  this._incPendingOps();
  bs.pipe(ws).on('finish', this._decPendingOps.bind(this));

  return bs;
};

/**
 * Get stats for this bucket
 * @param {Sbucket~statCallback}
 */
Sbucket.prototype.stat = function(callback) {
  var self = this;

  this._incPendingOps();
  this._db.approximateSize(
    Sbucket.SIZE_START_KEY,
    Sbucket.SIZE_END_KEY,
    function(err, size) {
      self._decPendingOps();

      if (err) {
        return callback(err);
      }

      callback(null, {
        size: size,
        free: self._maxSize - size
      });
    }
  );
};
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
Sbucket.prototype.list = function(callback) {
  var self = this;
  var iterator = this._db.iterator({
    gte: Sbucket.SIZE_START_KEY,
    lte: Sbucket.SIZE_END_KEY,
    values: false,
    keyAsBuffer: false
  });
  var keys = {};
  var currentResult = null;

  function _test() {
    return currentResult === null;
  }

  function _accumulateKey(next) {
    iterator.next(function(err, key) {
      if (err) {
        return next(err);
      }

      if (!key) {
        currentResult = null;
        return next();
      }

      currentResult = key.split(' ')[0];
      keys[currentResult] = keys[currentResult] ?
                            keys[currentResult] + self._options.chunkSize :
                            self._options.chunkSize;

      next();
    });
  }

  this._incPendingOps();
  async.doUntil(_accumulateKey, _test, function(err) {
    self._decPendingOps();

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
};
/**
 * @callback Sbucket~listCallback
 * @param {Error} [error]
 * @param {Object[]} results
 * @param {String} results.baseKey
 * @param {Number} results.approximateSize
 */

/**
 * Increments the pending operations counter
 * @private
 */
Sbucket.prototype._incPendingOps = function() {
  this._pendingOperations++;
};

/**
 * Decrements the pending operations counter
 * @private
 * @fires Sbucket#idle
 */
Sbucket.prototype._decPendingOps = function() {
  this._pendingOperations--;
  setImmediate(this._checkIdleState.bind(this));
};

/**
 * Emits the idle event if state is idle
 * @private
 */
Sbucket.prototype._emitIfStateIsIdle = function() {
  if (this._pendingOperations === 0) {
    this.emit('idle');
    return true;
  }

  return false;
};

/**
 * Checks the idle state and triggers a timeout for emitting the idle event
 * @private
 * @returns {Boolean} hasNoPendingOperations
 */
Sbucket.prototype._checkIdleState = function() {
  if (this._pendingOperations !== 0) {
    return false;
  }

  setTimeout(this._emitIfStateIsIdle.bind(this), constants.SBUCKET_IDLE);
  return true;
};

module.exports = Sbucket;
