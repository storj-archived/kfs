/**
 * @module kfs
 */

'use strict';

const Btable = require('./lib/b-table');

/**
 * Returns a constructed {@link Btable}
 * @function
 * @param {string} path - Path to the KFS store
 * @param {object} [options] - {@link Btable} options
 */
module.exports = (path, opts) => new Btable(path, opts);

/** {@link Btable} */
module.exports.Btable = Btable;

/** {@link Sbucket} */
module.exports.Sbucket = require('./lib/s-bucket');

/** {@link BlockStream} */
module.exports.BlockStream = require('./lib/block-stream');

/** {@link ReadableFileStream} */
module.exports.ReadableFileStream = require('./lib/read-stream');

/** {@link WritableFileStream} */
module.exports.WritableFileStream = require('./lib/write-stream');

/** {@link module:kfs/constants} */
module.exports.constants = require('./lib/constants');

/** {@link module:kfs/utils} */
module.exports.utils = require('./lib/utils');
