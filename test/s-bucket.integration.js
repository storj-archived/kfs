'use strict';

var Sbucket = require('../lib/s-bucket');
var expect = require('chai').expect;
var sinon = require('sinon');
var async = require('async');
var os = require('os');
var path = require('path');
var utils = require('../lib/utils');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

describe('Sbucket/Integration', function() {

  var TMP_DIR = path.join(os.tmpdir(), 'KFS_SANDBOX');
  var BUCKET_PATH = path.join(TMP_DIR, 'testdb-sbucket-integration');
  var bucket = null;

  before(function(done) {
    if (utils.fileDoesExist(TMP_DIR)) {
      rimraf.sync(TMP_DIR);
    }
    mkdirp(TMP_DIR, function() {
      bucket = new Sbucket(BUCKET_PATH);
      bucket.open(done);
    });
  });

  after(function() {
    rimraf.sync(TMP_DIR);
  });

  describe('#all', function() {
    var file0 = Buffer.allocUnsafe(65536 * 2);
    var file1 = Buffer.allocUnsafe(65536 * 2);
    var file2 = Buffer.allocUnsafe(65536 * 5);

    before(function(done) {
      var index = 0;
      async.eachSeries([file0, file1, file2], function(buf, next) {
        bucket.writeFile(index.toString(), buf, function(err) {
          index++;
          next(err);
        });
      }, done);
    });

    it('should list all of the files', function(done) {
      bucket.list(function(err, list) {
        expect(list).to.have.lengthOf(3);
        done();
      });
    });

    it('should bubble errors from te iterator', function(done) {
      var _iterator = sinon.stub(bucket._db, 'iterator').returns({
        next: sinon.stub().callsArgWith(0, new Error('Failed'))
      });
      bucket.list(function(err) {
        _iterator.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should read successfully by range (0-500)', function(done) {
      let position = 0;
      let length = 20;
      bucket.readFileRange('0', position, length, (err, buff) => {
        if (err) {
          return done(err);
        }

        expect(buff.toString('hex')).to.equal(file0.slice(position, position + length).toString('hex'));
        done();
      });

    });

    it('should read successfully by range (1000-1500)', function(done) {
      let position = 1000;
      let length = 20;
      bucket.readFileRange('0', position, length, (err, buff) => {
        if (err) {
          return done(err);
        }

        expect(buff.toString('hex')).to.equal(file0.slice(position, position + length).toString('hex'));
        done();
      });

    });

    it('should read successfully by range (beyond buffer end)', function(done) {
      let position = file0.length-10;
      let length = 20;
      bucket.readFileRange('0', position, length, (err, buff) => {
        if (err) {
          return done(err);
        }

        console.log(buff);
        console.log(file0.slice(position, position + length));

        expect(buff.toString('hex')).to.equal(file0.slice(position, position + length).toString('hex'));
        done();
      });

    });

    it('should read successfully by range (cross multiple chunks)', function(done) {
      let position = bucket._chunkSize*2 - 10;
      let length = 20;
      bucket.readFileRange('2', position, length, (err, buff) => {
        if (err) {
          return done(err);
        }

        expect(buff.toString('hex')).to.equal(file2.slice(position, position + length).toString('hex'));
        done();
      });

    });

  });


});
