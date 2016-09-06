'use strict';

var runWriteSpeedBenchmark = require('./write-speed');
var runReadSpeedBenchmark = require('./read-speed');

/**
 * Runs the performance benchmarks and passes results to callback
 * @param {Object} options
 * @param {String} options.tmpPath - Path to create the temp database
 * @param {Boolean} options.showLogs - Print verbose information to console
 * @param {Function} callback
 */
module.exports = function(options, callback) {
  runWriteSpeedBenchmark(options.tmpPath, function(err, writeResults) {
    if (err) {
      return callback(err);
    }

    runReadSpeedBenchmark(options.tmpPath, function(err, readResults) {
      if (err) {
        return callback(err);
      }

      callback(null, writeResults, readResults);
    });
  });
};

if (process.argv[2] === 'exec') {
  module.exports({
    tmpPath: '',
    showLogs: true
  }, function(err, writeResults, readResults) {
    if (err) {
      return console.error('Error running benchmarks:', err);
    }

    console.info(
      module.exports.formatResults(writeResults, readResults)
    );
  });
}
