'use strict';

var kfs = require('..');
var async = require('async');

module.exports = function(options, wResults, rResults, callback) {
  console.log('Unlinking (deleting) data written to database...');

  var uResults = [];
  var database = options.bTable;
  var totalSizeFlushed = 0;

  async.eachOfSeries(rResults, function(readResultItem, i, next) {
    var time = 0;
    var timer = setInterval(function() { time += 10 }, 10);

    totalSizeFlushed += readResultItem.fileSizeBytes;

    database.unlink(readResultItem.fileKey, function(err) {
      if (err) {
        return next(err);
      }

      clearInterval(timer);
      uResults.push({
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

    var time = 0;
    var timer = setInterval(function() { time += 10 }, 10);

    console.log('Flushing (compacting) data unlinked from database...');
    database.flush(function(err) {
      var fResults = {
        msElapsed: time,
        bytesFlushed: totalSizeFlushed
      };

      callback(err, wResults, rResults, uResults, fResults);
    });
  });
};
