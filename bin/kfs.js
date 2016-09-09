#!/usr/bin/env node

'use strict';

var kfs = require('..');
var program = require('commander');
var path = require('path');
var fs = require('fs');
var platform = require('os').platform();

var HOME = platform !== 'win32' ? process.env.HOME : process.env.USERPROFILE;
var DEFAULT_DB = path.join(HOME, '.kfs', 'default');

function _openDatabase(callback) {
  var db = kfs(program.db);

  db.once('ready', function() {
    db.removeListener('error', callback);
    callback(null, db);
  });

  db.once('error', function(err) {
    db.removeListener('ready', callback);
    callback(err);
  });
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

function _statFileForDatabase(fileKey, opts) {
  _openDatabase(function(err, db) {
    if (err) {
      process.stderr.write('[error] ' + err.message);
      process.exit(1);
    }

    db.getSpaceAvailableForKey(fileKey, function(err, freeSpace, sIndex) {
      if (err) {
        process.stderr.write('[error] ' + err.message);
        process.exit(1);
      }

      if (opts.human) {
        freeSpace = kfs.utils.toHumanReadableSize(freeSpace);
      }

      process.stdout.write(
        kfs.utils.createSbucketNameFromIndex(sIndex) +
        '\t' +
        freeSpace
      );
      process.exit(0);
    });
  });
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
  .command('stat <file_key>')
  .option('-h, --human', 'print human readable format')
  .description('get the available space for a file key')
  .action(_statFileForDatabase);

program
  .command('*')
  .description('print usage information to the console')
  .action(program.help);

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
