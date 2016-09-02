'use strict';

var merge = require('merge');
var stream = require('readable-stream');
var assert = require('assert');
var levelup = require('levelup');
var inherits = require('util').inherits;
var events = require('events');
var constants = require('./constants');

/**
 * Capped LevelDB database within a {@link Btable}
 * @constructor
 * @param {String} dbPath - The path to database on disk
 * @param {Object} [options]
 */
function Sbucket(dbPath, options) {
  if (!(this instanceof Sbucket)) {
    return new Sbucket(dbPath, options);
  }

  events.EventEmitter.call(this);

  this._options = merge(Object.create(Sbucket.DEFAULTS), options);
  this._db = levelup(dbPath, {
    maxOpenFiles: this._options.maxOpenFiles,
    db: this._options.levelupBackend,
    valueEncoding: this._options.valueEncoding,
    compression: this._options.compression,
    cacheSize: this._options.cacheSize,
    createIfMissing: this._options.createIfMissing,
    errorIfExists: this._options.errorIfExists
  });

  this._bindDbEventBubbles();
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

Sbucket.SIZE_START_KEY = '0';
Sbucket.SIZE_END_KEY = 'z';
Sbucket.DEFAULTS = {
  maxOpenFiles: 1000,
  levelupBackend: null,
  valueEncoding: 'binary',
  compression: true,
  cacheSize: 8 * (1024 * 1024),
  createIfMissing: true,
  errorIfExists: false
};

/**
 * Opens the underlying database
 * @fires Sbucket#open
 * @param {Sbucket~openCallback}
 */
Sbucket.prototype.open = function(callback) {
  this._db.open(callback);
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
Sbucket.prototype.close = function() {
  this._db.close(callback);
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
  this._db.get(utils.createItemKeyFromIndex(key, 0), function(err) {
    callback(!err);
  });
};
/**
 * @callback Sbucket~existsCallback
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
    self._db.get(utils.createItemKeyFromIndex(key, index), function(err) {
      index++;

      if (!err) {
        self._db.del(itemkey, function() {
          _del(index, callback);
        });
      } else if (err.type === 'NotFoundError') {
        callback(null);
      } else {
        callback(err);
      }
    });
  }

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
    callback(null, fileBuffer);
  });

  readStream.on('error', function(err) {
    readStream.removeAllListeners();
    callback(err);
  });
};
/**
 * @callback Sbucket~readFileCallback
 * @param {Error} [error]
 * @param {Buffer} fileBuffer
 */

/**
 * Writes the buffer to the given key
 * @param {String} key - The key for the file to write
 * @param {Buffer|String} buffer - The data to write to the given key
 * @param {Sbucket~writeFileCallback}
 */
Sbucket.prototype.writeFile = function(key, buffer, callback) {
  var self = this;
  var writeStream = this.createWriteStream(key);
  var whichSlice = 0;

  function _writeFileSlice() {
    var startIndex = whichSlice * constants.C;
    var endIndex = startIndex + constants.C;
    var bufferSlice = buffer.slice(startIndex, endIndex);

    if (bufferSlice.length === 0) {
      return writeStream.end();
    }

    writeStream.write(bufferSlice);
    _writeFileSlice();
  }

  writeStream.on('finish', function() {
    callback(null);
  });

  writeStream.on('error', function(err) {
    writeStream.removeAllListeners();
    callback(err);
  });

  this.unlink(key, function(err) {
    if (err) {
      return callback(err);
    }

    _writeFileSlice();
  });
};
/**
 * @callback Sbucket~writeFileCallback
 * @param {Error} [error]
 */

/**
 * Returns a readable stream of the file at the given key
 * @param {String} key - The key for the file to read
 * @returns {ReadableStream}
 */
Sbucket.prototype.createReadStream = function(key) {
  var self = this;
  var index = 0;

  return this._decorateStreamWithDestroy(key, new stream.Readable({
    read: function() {
      var rs = this;

      self._db.get(
        utils.createItemKeyFromIndex(key, index),
        function(err, result) {
          if (err) {
            if (err.type === 'NotFoundError') {
              return rs.push(null);
            } else {
              return rs.emit('error', err);
            }
          }

          index++;
          rs.push(Buffer(result, 'binary'));
        }
      );
    }
  }));
};

/**
 * Returns a writable stream for a file at the given key
 * @param {String} key - The key for the file to read
 * @returns {WritableStream}
 */
Sbucket.prototype.createWriteStream = function(key) {
  var self = this;
  var index = 0;

  return this._decorateStreamWithDestroy(key, new stream.Writable({
    write: function(bytes, encoding, callback) {
      var ws = this;

      self._db.put(
        utils.createItemKeyFromIndex(key, index),
        bytes,
        function(err) {
          if (err) {
            return callback(err);
          }

          index++;
          callback();
        }
      );
    }
  }));
};

/**
 * Get stats for this bucket
 * @param {Sbucket~statCallback}
 */
Sbucket.prototype.stat = function(callback) {
  this._db.db.approximateSize(
    Sbucket.SIZE_START_KEY,
    Sbucket.SIZE_END_KEY,
    function(err, size) {
      if (err) {
        return callback(err);
      }

      callback(null, {
        size: size,
        free: constants.S - size
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
 * Decorates a stream with a destroy method to remove any data written
 * @private
 * @param {String} key
 * @param {Stream} stream
 */
Sbucket.prototype._decorateStreamWithDestroy = function(key, stream) {
  var self = this;

  stream.destroy = function(callback) {
    self.unlink(key, callback || utils.noop);
  };

  return stream;
};

/**
 * Checks if the levelup backend is using leveldown
 * @private
 * @returns {Boolean}
 */
Sbucket.prototype._isUsingDefaultBackend = function() {
  return this._options.levelupBackend === Sbucket.DEFAULTS.levelupBackend;
};

/**
 * Sets up event bubbles from underlying db
 * @private
 */
Sbucket.prototype._bindDbEventBubbles = function() {
  var self = this;

  this._db.on('ready', function() {
    self.emit('open');
  });

  this._db.on('closed', function() {
    self.emit('close');
  });
};

module.exports = Sbucket;
