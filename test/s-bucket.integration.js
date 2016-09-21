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

  describe('#list', function() {

    before(function(done) {
      var file0 = new Buffer(65536);
      var file1 = new Buffer(65536 * 2);
      var file2 = new Buffer(65536);
      var index = 0;
      async.eachSeries([file0, file1, file2], function(buf, next) {
        buf.fill(1);
        bucket.writeFile(index.toString(), buf, function() {
          index++;
          next();
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

  });

  after(function() {
    rimraf.sync(TMP_DIR);
  });

});
