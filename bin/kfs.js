#!/usr/bin/env node

'use strict';

var kfs = require('..');
var program = require('commander');
var path = require('path');
var fs = require('fs');
var platform = require('os').platform();
var async = require('async');

var HOME = platform !== 'win32' ? process.env.HOME : process.env.USERPROFILE;
var DEFAULT_DB = path.join(HOME, '.kfs', 'default');

function _openDatabase(callback) {
  var db;

  try {
    db = kfs(program.db);
  } catch (err) {
    return callback(err);
  }

  callback(null, db);
}

function _writeFileToDatabase(fileKey, filePath) {
  _openDatabase(function(err, db) {
    if (err) {
      process.stderr.write('[error] ' + err.message);
      process.exit(1);
    }

    if (filePath) {
      if (!kfs.utils.fileDoesExist(filePath)) {
        process.stderr.write('[error] ' + 'File does not exist');
        process.exit(1);
      }

      var fileBuffer = fs.readFileSync(filePath);

      db.writeFile(fileKey, fileBuffer, function(err) {
        if (err) {
          process.stderr.write('[error] ' + err.message);
          process.exit(1);
        }

        process.exit(0);
      });
    } else {
      db.createWriteStream(fileKey, function(err, writableStream) {
        if (err) {
          process.stderr.write('[error] ' + err.message);
          process.exit(1);
        }

        writableStream.on('error', function(err) {
          process.stderr.write('[error] ' + err.message);
          process.exit(1);
        });

        writableStream.on('finish', function() {
          process.exit(0);
        });

        process.stdin.pipe(writableStream);
      });
    }
  });
};

function _readFileFromDatabase(fileKey, outPath) {
   _openDatabase(function(err, db) {
    if (err) {
      process.stderr.write('[error] ' + err.message);
      process.exit(1);
    }

    db.createReadStream(fileKey, function(err, readableStream) {
      if (err) {
        process.stderr.write('[error] ' + err.message);
        process.exit(1);
      }

      readableStream.on('error', function(err) {
        process.stderr.write('[error] ' + err.message);
        process.exit(1);
      });

      readableStream.on('end', function() {
        process.exit(0);
      });

      if (outPath) {
        var writeStream = fs.createWriteStream(outPath);

        writeStream.on('error', function(err) {
          process.stderr.write('[error] ' + err.message);
          process.exit(1);
        });

        writeStream.on('finish', function() {
          process.exit(0);
        });

        readableStream.pipe(writeStream);
      } else {
        readableStream.pipe(process.stdout);
      }
    });
 });
}

function _unlinkFileFromDatabase(fileKey) {
  _openDatabase(function(err, db) {
    if (err) {
      process.stderr.write('[error] ' + err.message);
      process.exit(1);
    }

    db.unlink(fileKey, function(err) {
      if (err) {
        process.stderr.write('[error] ' + err.message);
        process.exit(1);
      }

      process.exit(0);
    });
  });
}

function _statDatabase(keyOrIndex, opts) {
  _openDatabase(function(err, db) {
    if (err) {
      process.stderr.write('[error] ' + err.message);
      process.exit(1);
    }

    if (!keyOrIndex) {
      db.stat(_statCallback);
    } else {
      db.stat(keyOrIndex, _statCallback);
    }

    function _statCallback(err, stats) {
      if (err) {
        process.stderr.write('[error] ' + err.message);
        process.exit(1);
      }

      var spacing = 2;

      stats = stats.map(function(sBucketStats) {
        var perc = sBucketStats.sBucketStats.size /
                   sBucketStats.sBucketStats.free;

        sBucketStats.sBucketStats.perc = (perc * 100).toFixed(2);

        if (opts.human) {
          sBucketStats.sBucketStats.size = kfs.utils.toHumanReadableSize(
            sBucketStats.sBucketStats.size
          );
        }

        var sizeOutLength = sBucketStats.sBucketStats.size.toString().length;
        spacing = spacing < sizeOutLength ? sizeOutLength + 1 : spacing

        return sBucketStats;
      });

      stats.forEach(function(sBucketStats) {
        process.stdout.write(
          kfs.utils.createSbucketNameFromIndex(sBucketStats.sBucketIndex) +
          '\t' +
          sBucketStats.sBucketStats.size +
          Array(
            spacing + 1 - sBucketStats.sBucketStats.size.toString().length
          ).join(' ') +
          '(' + sBucketStats.sBucketStats.perc + '%)' +
          '\n'
        );
      });

      process.exit(0);
    }
  });
}

function _compactDatabase() {
  var sBucketList = fs.readdirSync(
    kfs.utils.coerceTablePath(program.db)
  ).filter(function(fileName) {
    return fileName !== kfs.RID_FILENAME;
  });

  async.eachSeries(sBucketList, function(sBucketName, next) {
    require('leveldown').repair(
      path.join(kfs.utils.coerceTablePath(program.db), sBucketName),
      function(err) {
        if (err) {
          process.stderr.write('[error] ' + err.message);
          process.exit(1)
        }

        process.stdout.write(sBucketName + ' (done!)\n');
        next();
      }
    );
  });
}

function _listItemsInDatabase(bucketIndex, env) {
  _openDatabase(function(err, db) {
    if (err) {
      process.stderr.write('[error] ' + err.message);
      process.exit(1);
    }

    db.list(bucketIndex, function(err, keys) {
      if (err) {
        process.stderr.write('[error] ' + err.message);
        process.exit(1);
      }

      keys.forEach(function(result) {
        process.stdout.write(
          result.baseKey + '\t' +
          (env.human ?
            '~' + kfs.utils.toHumanReadableSize(result.approximateSize) :
            '~' + result.approximateSize) +
          '\n'
        );
      });
    });
  });
}

function _showHelp() {
  program.help();
}

program
  .version(require('../package').version)
  .option(
    '-d, --db <db_path>',
    'path the kfs database to use (default: ' + DEFAULT_DB + ')',
    DEFAULT_DB
  );

program
  .command('write <file_key> [file_path]')
  .description('write the file to the database (or read from stdin)')
  .action(_writeFileToDatabase);

program
  .command('read <file_key> [file_path]')
  .description('read the file from the database (or write to stdout)')
  .action(_readFileFromDatabase);

program
  .command('unlink <file_key>')
  .description('unlink (delete) the file from the database')
  .action(_unlinkFileFromDatabase);

program
  .command('list <bucket_index_or_file_index>')
  .option('-h, --human', 'print human readable format')
  .description('list all of the file keys in the given bucket')
  .action(_listItemsInDatabase);

program
  .command('stat [bucket_index_or_file_key]')
  .option('-h, --human', 'print human readable format')
  .description('get the free and used space for the database ')
  .action(_statDatabase);

program
  .command('compact')
  .description('trigger a compaction of all database buckets')
  .action(_compactDatabase);

program
  .command('*')
  .description('print usage information to the console')
  .action(_showHelp);

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
