'use strict';

var kfs = require('..');
var async = require('async');

module.exports = function(options, wResults, rResults, callback) {
  console.log('Unlinking (deleting) data written to database...');

  var results = [];
  var database = options.bTable;

  async.eachOfSeries(rResults, function(readResultItem, i, next) {
    var time = 0;
    var timer = setInterval(function() { time += 10 }, 10);

    database.unlink(readResultItem.fileKey, function(err) {
      if (err) {
        return next(err);
      }

      clearInterval(timer);
      results.push({
        msElapsed: time,
        fileKey: readResultItem.fileKey,
        sBucketIndex: readResultItem.sBucketIndex,
        fileSizeBytes: readResultItem.fileSizeBytes
      });
      next();
    });
  }, function(err) {
    if (err) {
      return callback(err);
    }

    callback(null, wResults, rResults, results);
  });
};
