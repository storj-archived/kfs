'use strict';

var inherits = require('util').inherits;
var merge = require('merge');
var events = require('events');
var fs = require('fs');
var mkdirp = require('mkdirp');
var utils = require('./utils');
var constants = require('./constants');
var Sbucket = require('./s-bucket');
var path = require('path');
var assert = require('assert');
var async = require('async');

/**
 * A series of {@link Sbucket}s composing a sharded table
 * @constructor
 * @param {String} tablePath - The path to the directory to store the table
 * @param {Object} [options]
 * @param {String} [options.referenceId] - R bit hex reference ID
 * @param {Number} [options.maxTableSize] - Max bytes to cap the database
 * @param {Object} [options.sBucketOpts] - Options to pass to Sbucket creation
 */
function Btable(tablePath, options) {
  if (!(this instanceof Btable)) {
    return new Btable(tablePath, options);
  }

  events.EventEmitter.call(this);

  this._options = merge(Object.create(Btable.DEFAULTS), options);
  this._rid = utils.createReferenceId(this._options.referenceId);
  this._sBuckets = {};
  this._tablePath = utils.coerceTablePath(tablePath);
  this._maxTableSize = this._options.maxTableSize;
  this._options.sBucketOpts.maxSize = this._maxTableSize / constants.B;

  this._open();
}

inherits(Btable, events.EventEmitter);

Btable.RID_FILENAME = 'r.id';
Btable.DEFAULTS = {
  referenceId: null,
  maxTableSize: constants.S * constants.B,
  sBucketOpts: {}
};

/**
 * Opens the Btable, creating it if it does not exist
 * @private
 */
Btable.prototype._open = function() {
  if (!utils.fileDoesExist(this._tablePath)) {
    this._initBtableDirectory();
  } else {
    this._validateTablePath();
  }

  this._rid = Buffer(fs.readFileSync(
    path.join(this._tablePath, Btable.RID_FILENAME),
    { encoding: 'hex' }
  ), 'hex');
};

/**
 * Initializes a new KFS database (B-table directory)
 * @private
 */
Btable.prototype._initBtableDirectory = function() {
  mkdirp.sync(this._tablePath);
  fs.writeFileSync(
    path.join(this._tablePath, Btable.RID_FILENAME),
    this._rid,
    { encoding: 'hex' }
  );
};

/**
 * Validates a path to a directory as a KFS instance
 * @private
 */
Btable.prototype._validateTablePath = function() {
  var dirStats = fs.statSync(this._tablePath);

  assert(dirStats.isDirectory(), 'Table path is not a directory');

  var requiredPaths = [Btable.RID_FILENAME];
  var dirContents = fs.readdirSync(this._tablePath);

  for (var i = 0; i < requiredPaths.length; i++) {
    assert(
      dirContents.indexOf(requiredPaths[i]) !== -1,
      'Table path is not a valid KFS instance'
    );
  }
};

/**
 * Determine the {@link Sbucket} index for a given key
 * @private
 * @param {String} key - The data key to route
 * @returns {Number}
 */
Btable.prototype._getSbucketIndexForKey = function(key) {
  return this._rid[0] ^ Buffer(utils.hashKey(key), 'hex')[0];
};

/**
 * Get the {@link Sbucket} for the supplied index
 * @private
 * @param {Number} sBucketIndex - The index for the desired bucket
 * @returns {Sbucket}
 */
Btable.prototype._getSbucketAtIndex = function(sBucketIndex) {
  assert(sBucketIndex < constants.B, 'Index must not be greater than B');
  assert(sBucketIndex > -1, 'Index must be greater than or equal to 0');

  if (this._sBuckets[sBucketIndex]) {
    return this._sBuckets[sBucketIndex];
  }

  this._sBuckets[sBucketIndex] = new Sbucket(
    path.join(this._tablePath, utils.createSbucketNameFromIndex(sBucketIndex)),
    this._options.sBucketOpts
  );

  this._sBuckets[sBucketIndex].removeAllListeners('idle');
  this._sBuckets[sBucketIndex].once(
    'idle',
    this._sBuckets[sBucketIndex].close.bind(this._sBuckets[sBucketIndex])
  );

  return this._sBuckets[sBucketIndex];
};

/**
 * Get the {@link Sbucket} for the given key
 * @private
 * @param {String} key - The key that maps to a {@link Sbucket}
 * @param {Btable~_getSbucketForKeyCallback}
 */
Btable.prototype._getSbucketForKey = function(key, callback) {
  var sIndex = typeof key === 'number' ? key : this._getSbucketIndexForKey(key);
  var sBucket = this._getSbucketAtIndex(sIndex);

  if (sBucket.readyState !== Sbucket.OPENED) {
    return sBucket.open(function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, sBucket, sIndex);
    });
  }

  callback(null, sBucket, sIndex);
};
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
Btable.prototype.stat = function(keyOrIndex, callback) {
  var self = this;

  if (typeof keyOrIndex === 'function') {
    callback = keyOrIndex;
    keyOrIndex = null;
  }

  if (keyOrIndex) {
    return _getStat(keyOrIndex, function(err, stats) {
      callback(err, stats ? [stats] : undefined);
    });
  }

  var sBuckets = fs.readdirSync(this._tablePath).filter(function(name) {
    return name !== Btable.RID_FILENAME;
  }).map(function(sBucketName) {
    return parseInt(sBucketName);
  }).filter(function(sBucketIndex) {
    return !Number.isNaN(sBucketIndex) && typeof sBucketIndex === 'number';
  });

  function _getStat(sBucketIndex, done) {
    self._getSbucketForKey(sBucketIndex, function(err, sBucket, sIndex) {
      if (err) {
        return done(err);
      }

      sBucket.stat(function(err, stats) {
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
};
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
Btable.prototype.list = function(keyOrIndex, callback) {
  var key = typeof keyOrIndex === 'number' ?
    keyOrIndex :
    utils.coerceKey(keyOrIndex);

  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    sBucket.list(callback);
  });
};

/**
 * Check if a file exists at the supplied key
 * @param {String} key - The key to check for existence
 * @param {Sbucket~existsCallback}
 */
Btable.prototype.exists = function(key, callback) {
  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    sBucket.exists(key, callback);
  });
};

/**
 * Unlinks the data for the given key
 * @param {String} key - The key to unlink data from
 * @param {Sbucket~unlinkCallback}
 */
Btable.prototype.unlink = function(key, callback) {
  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    sBucket.unlink(key, callback);
  });
};

/**
 * Reads the data at the supplied key into a buffer
 * @param {String} key - The key for the data to read
 * @param {Sbucket~readFileCallback}
 */
Btable.prototype.readFile = function(key, callback) {
  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    sBucket.readFile(key, callback);
  });
};

/**
 * Creates a readable stream of the data at the given key
 * @param {String} key - The key for the data read
 * @param {Btable~createReadStreamCallback}
 */
Btable.prototype.createReadStream = function(key, callback) {
  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    callback(null, sBucket.createReadStream(key));
  });
};
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
Btable.prototype.writeFile = function(key, buffer, callback) {
  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    sBucket.writeFile(key, buffer, callback);
  });
};

/**
 * Creates a writable stream to the given key
 * @param {String} key - The key to write the data to
 * @param {Btable~createWriteStreamCallback}
 */
Btable.prototype.createWriteStream = function(key, callback) {
  this._getSbucketForKey(key, function(err, sBucket) {
    if (err) {
      return callback(err);
    }

    callback(null, sBucket.createWriteStream(key));
  });
};
/**
 * @callback Btable~createWriteStreamCallback
 * @param {Error} [error]
 * @param {WritableStream} writeStream
 */

module.exports = Btable;
