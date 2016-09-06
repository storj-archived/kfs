'use strict';

var os = require('os');
var path = require('path');
var utils = require('../lib/utils');
var Btable = require('../lib/b-table');
var expect = require('chai').expect;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var constants = require('../lib/constants');
var crypto = require('crypto');

describe('Btable/Integration', function() {

  var TMP_DIR = path.join(os.tmpdir(), 'KFS_SANDBOX');
  var TABLE_PATH = path.join(TMP_DIR, 'testdb');
  var db = null;

  before(function(done) {
    if (utils.fileDoesExist(TMP_DIR)) {
      rimraf.sync(TMP_DIR);
    }
    mkdirp(TMP_DIR, function() {
      db = new Btable(TABLE_PATH);
      done();
    });
  });

  describe('#getSpaceAvailableForKey', function() {

    it('should callback with correct free space for key', function(done) {
      var key = utils.createReferenceId().toString('hex');
      db.getSpaceAvailableForKey(key, function(e, free) {
        expect(e).to.equal(null);
        expect(free).to.equal(constants.S);
        done();
      });
    });

  });

  describe('#writeFile', function() {

    it('should write the file to the database', function(done) {
      var fileData = new Buffer('hello kfs!');
      var fileHash = crypto.createHash('sha1').update(fileData).digest('hex');
      db.writeFile(fileHash, fileData, function(err) {
        expect(err).to.equal(null);
        done();
      });
    });

  });

  describe('#createWriteStream', function() {

    it('should write the stream to the database', function(done) {
      var fileData = new Buffer('kfs hello!');
      var fileHash = crypto.createHash('sha1').update(fileData).digest('hex');
      db.createWriteStream(fileHash, function(err, writableStream) {
        expect(err).to.equal(null);
        writableStream.on('finish', done);
        writableStream.on('error', done);
        writableStream.write(fileData);
        writableStream.end();
      });
    });

  });

  describe('#readFile', function() {

    it('should read the file from the database', function(done) {
      var fileData = new Buffer('hello kfs!');
      var fileHash = crypto.createHash('sha1').update(fileData).digest('hex');
      db.readFile(fileHash, function(err, result) {
        expect(err).to.equal(null);
        expect(Buffer.compare(result, fileData)).to.equal(0);
        done();
      });
    });

  });

  describe('#createReadStream', function() {

    it('should write the stream to the database', function(done) {
      var fileData = new Buffer('kfs hello!');
      var fileHash = crypto.createHash('sha1').update(fileData).digest('hex');
      db.createReadStream(fileHash, function(err, readableStream) {
        expect(err).to.equal(null);
        var data = Buffer([]);
        readableStream.on('data', function(chunk) {
          data = Buffer.concat([data, chunk]);
        });
        readableStream.on('end', function() {
          expect(Buffer.compare(fileData, data)).to.equal(0);
          done();
        });
        readableStream.on('error', done);
      });
    });

  });

  describe('#exists', function() {

    it('should callback true for a existing key', function(done) {
      var fileData = new Buffer('hello kfs!');
      var fileHash = crypto.createHash('sha1').update(fileData).digest('hex');
      db.exists(fileHash, function(exists) {
        expect(exists).to.equal(true);
        done();
      });
    });

    it('should callback false for non-existent key', function(done) {
      var key = utils.createReferenceId().toString('hex');
      db.exists(key, function(exists) {
        expect(exists).to.equal(false);
        done();
      });
    });

  });

  describe('#unlink', function() {

    it('should destroy the file from the database', function(done) {
      var fileData = new Buffer('hello kfs!');
      var fileHash = crypto.createHash('sha1').update(fileData).digest('hex');
      db.unlink(fileHash, function(err) {
        expect(err).to.equal(null);
        db.exists(fileHash, function(exists) {
          expect(exists).to.equal(false);
          done();
        });
      });
    });

  });

  after(function() {
    rimraf.sync(TMP_DIR);
  });

});

