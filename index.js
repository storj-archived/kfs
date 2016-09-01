/**
 * @module kfs
 */

'use strict';

module.exports = require('./lib/b-table');

/** {@link Btable} */
module.exports.Btable = require('./lib/b-table');

/** {@link Sbucket} */
module.exports.Sbucket = require('./lib/s-bucket');

/** {@link RpcClient} */
module.exports.RpcClient = require('./lib/rpc-client');

/** {@link RpcServer} */
module.exports.RpcServer = require('./lib/rpc-server');

/** {@link module:kfs/constants} */
module.exports.constants = require('./lib/constants');

/** {@link module:kfs/utils} */
module.exports.utils = require('./lib/utils');
