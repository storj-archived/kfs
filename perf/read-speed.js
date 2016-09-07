'use strict';

var kfs = require('..');
var async = require('async');

module.exports = function(options, wResults, callback) {
  console.log('Starting read tests from previously written data...');

  var results = [];
  var database = options.bTable;

  async.eachOfSeries(wResults, function(writeResultItem, i, next) {
    database.createReadStream(writeResultItem.fileKey, function(err, stream) {
      if (err) {
        return next(err);
      }

      var bytesRead = 0;
      var time = 0;
      var timer = setInterval(function() { time += 10; }, 10);

      stream.on('error', function(err) {
        next(err);
      });

      stream.on('data', function(chunk) {
        bytesRead += chunk.length;
      });

      stream.on('end', function() {
        clearInterval(timer);
        results.push({
          msElapsed: time,
          fileKey: writeResultItem.fileKey,
          sBucketIndex: writeResultItem.sBucketIndex,
          fileSizeBytes: bytesRead
        });
        next();
      });
    });
  }, function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, wResults, results);
  });
};
