/**
 * @module kfs/constants
 */

'use strict';

module.exports = {
  /** @constant {Number} R - Number of bits in Reference ID */
  R: 160,
  /** @constant {Number} C - Number of bytes in a file chunk */
  C: 131072,
  /** @constant {Number} S - Number of bytes in a {@link Sbucket} */
  S: 32 * (1024 * 1024 * 1024),
  /** @constant {Number} B - Number of columns in a {@link Btable} */
  B: 256,
  /** @constant {String} HASH - OpenSSL id for key hashing algorithm */
  HASH: 'sha1',
  /** @constant {Number} SBUCKET_IDLE - Time to wait before idle event */
  SBUCKET_IDLE: 60000
};
