'use strict';

var kfs = require('..');
var noisegen = require('noisegen');
var fs = require('fs');
var async = require('async');
var path = require('path')

module.exports = function(options, callback) {
  console.log('Generating some random files, hold on...');

  var results = [];
  var database = kfs(options.tablePath);
  var index = 0;

  async.eachSeries([
    8 * (1024 * 1024),
    16 * (1024 * 1024),
    32 * (1024 * 1024),
    64 * (1024 * 1024),
    128 * (1024 * 1024),
    256 * (1024 * 1024),
    512 * (1024 * 1024)
  ], function(numBytes, next) {
    console.log('Preparing %s byte file...', numBytes);
    var noise = noisegen({ length: numBytes });
    var file = fs.createWriteStream(
      path.join(options.tmpPath, index.toString() + '.dat')
    );
    index++;

    noise.pipe(file).on('error', next).on('finish', next);
  }, function(err) {
    console.log('Test files prepared, writing to KFS...')

    async.eachSeries([
      '0.dat',
      '1.dat',
      '2.dat',
      '3.dat',
      '4.dat',
      '5.dat',
      '6.dat'
    ], function(testFileName, next) {
      var time = 0;
      var timer = setInterval(function() { time += 10 }, 10);
      var key = kfs.utils.createReferenceId().toString('hex');

      database.createWriteStream(key, function(err, writeStream) {
        if (err) {
          return callback(err);
        }

        fs.createReadStream(
          path.join(options.tmpPath, testFileName)
        ).pipe(writeStream).on('error', function(err) {
          clearInterval(timer);
          next(err);
        }).on('finish', function() {
          clearInterval(timer);
          results.push({
            msElapsed: time,
            fileKey: key,
            sBucketIndex: database._getSbucketIndexForKey(key),
            fileSizeBytes: fs.statSync(
              path.join(options.tmpPath, testFileName)
            ).size
          });
          next();
        });
      });
    }, function(err) {
      if (err) {
        return callback(err);
      }

      callback(null, results);
    });
  });
};
