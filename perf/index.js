'use strict';

var os = require('os');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var async = require('async');
var kfs = require('..');
var fs = require('fs');

var runWriteSpeedBenchmark = require('./write-speed');
var runReadSpeedBenchmark = require('./read-speed');
var runUnlinkSpeedBenchmark = require('./unlink-speed');

/**
 * Runs the performance benchmarks and passes results to callback
 * @param {Object} options
 * @param {String} options.tmpPath - Path to create the sandbox
 * @param {String} options.tablePath - Path to create the database
 * @param {Btable} options.bTable - The {@link Btable} instance to use
 * @param {Function} callback
 */
module.exports = function(options, callback) {
  async.waterfall([
    runWriteSpeedBenchmark.bind(null, options),
    runReadSpeedBenchmark.bind(null, options),
    runUnlinkSpeedBenchmark.bind(null, options)
  ], callback);
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
  var testsRun = 0;
  var tests = parseInt(process.argv[3]) || 1;
  var resultsOut = process.argv[4];
  var referenceId = kfs.utils.createReferenceId().toString('hex');

  var TMP_PATH = path.join(
    process.env.KFS_PERF_DIR || os.tmpdir(),
    'KFS_PERF_SANDBOX'
  );
  var TABLE_PATH = path.join(TMP_PATH, Date.now().toString());

  if (kfs.utils.fileDoesExist(TMP_PATH)) {
    rimraf.sync(TMP_PATH);
  }

  mkdirp.sync(TABLE_PATH);

  var bTable = kfs(TABLE_PATH, { referenceId: referenceId });
  var results = [];

  function runBenchmarkTests() {
    console.log('Running test %s', testsRun + 1);

    module.exports({
      tmpPath: TMP_PATH,
      tablePath: TABLE_PATH,
      bTable: bTable
    }, function(err, writeResults, readResults, unlinkResults) {
      if (err) {
        return console.error('Error running benchmarks:', err);
      }

      testsRun++;

      results.push(module.exports.formatResults(
        writeResults,
        readResults,
        unlinkResults
      ));

      if (testsRun < tests) {
        return runBenchmarkTests();
      }

      console.log('Cleaning test environment...')
      rimraf.sync(TMP_PATH);

      if (resultsOut) {
        fs.writeFileSync(resultsOut, JSON.stringify(results));
        console.info('Results written to %s', resultsOut);
      } else {
        console.info(require('util').inspect(results, { depth: null }));
      }
    });
  }

  runBenchmarkTests();
}
