/**
 * @module kfs/constants
 */

'use strict';

module.exports = {
  /** @constant {Number} R - Number of bits in Reference ID */
  R: 160,
  /** @constant {Number} C - Number of bytes in a file chunk */
  C: 65536,
  /** @constant {Number} S - Number of bytes in a {@link Sbucket} */
  S: 32 * (1024 * 1024 * 1024),
  /** @constant {Number} B - Number of columns in a {@link Btable} */
  B: 256
};
