'use strict';

var os = require('os');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var utils = require('../lib/utils');

var runWriteSpeedBenchmark = require('./write-speed');
var runReadSpeedBenchmark = require('./read-speed');
var runUnlinkSpeedBenchmark = require('./unlink-speed');

/**
 * Runs the performance benchmarks and passes results to callback
 * @param {Object} options
 * @param {String} options.tmpPath - Path to create the sandbox
 * @param {String} options.tablePath - Path to create the database
 * @param {Function} callback
 */
module.exports = function(options, callback) {
  runWriteSpeedBenchmark(options, function(err, writeResults) {
    if (err) {
      return callback(err);
    }

    runReadSpeedBenchmark(options, function(err, readResults) {
      if (err) {
        return callback(err);
      }

      runUnlinkSpeedBenchmark(options, function(err, unlinkResults) {
        if (err) {
          return callback(err);
        }

        callback(null, writeResults, readResults, unlinkResults);
      });
    });
  });
};

/**
 * Formats the results into a human readable string
 * @param {Object} writeResults
 * @param {Object} readResults
 * @param {Object} unlinkResults
 */
module.exports.formatResults = function(writeRes, readRes, unlinkRes) {
  return {
    writes: writeRes,
    reads: readRes,
    unlinks: unlinkRes
  };
};

// NB: If we are running this as a script, go ahead and execute and print out
if (process.argv[2] === 'exec') {
  var TMP_PATH = path.join(os.tmpdir(), 'KFS_PERF_SANDBOX');
  var TABLE_PATH = path.join(TMP_PATH, Date.now().toString());

  if (utils.fileDoesExist(TMP_PATH)) {
    rimraf.sync(TMP_PATH);
  }

  mkdirp.sync(TABLE_PATH);
  module.exports({
    tmpPath: TMP_PATH,
    tablePath: TABLE_PATH
  }, function(err, writeResults, readResults, unlinkResults) {
    console.log('Cleaning test environment...')
    rimraf.sync(TMP_PATH);

    if (err) {
      return console.error('Error running benchmarks:', err);
    }

    console.info(
      module.exports.formatResults(writeResults, readResults, unlinkResults)
    );
  });
}
