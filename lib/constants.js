/**
 * @module kfs/constants
 */

'use strict';

module.exports = {
  /** @constant {Number} B - Number of bits in Reference ID */
  B: 160,
  /** @constant {Number} C - Number of bytes in a file chunk */
  C: 65536,
  /** @constant {Number} S - Number of bytes in a {@link SBucket} */
  S: 51.2 * (1024 * 1024 * 1024)
};
