'use strict';

var merge = require('merge');
var stream = require('readable-stream');
var assert = require('assert');
var levelup = require('levelup');
var inherits = require('util').inherits;
var events = require('events');

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

}

inherits(Sbucket, events.EventEmitter);

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
 */
Sbucket.prototype.open = function(callback) {
  this._db.open(callback);
};

/**
 * Closes the underlying database
 */
Sbucket.prototype.close = function() {
  this._db.close(callback);
};

/**
 * Determines if the file is already stored in the db
 * @param {String} key - The key for the file stored
 * @param {Function} callback
 */
Sbucket.prototype.exists = function(key, callback) {
  this._db.get(utils.createItemKeyFromIndex(key, 0), function(err) {
    callback(!err);
  });
};

/**
 * Deletes the file chunks from the database
 * @param {String} key - The key for the file stored
 * @param {Function} callback
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
            return ws.emit('error', err);
          }

          index++;
          callback();
        }
      );
    }
  }));
};

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

module.exports = Sbucket;
