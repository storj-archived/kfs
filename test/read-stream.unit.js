'use strict';

var ReadableFileStream = require('../lib/read-stream');
var sinon = require('sinon');
var expect = require('chai').expect;
var utils = require('../lib/utils');

describe('ReadableFileStream', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(ReadableFileStream({})).to.be.instanceOf(ReadableFileStream);
    });

  });

  describe('#_read', function() {

    it('should emit an error if get fails', function(done) {
      var rs = new ReadableFileStream({
        fileKey: utils.createReferenceId(),
        sBucket: {
          _db: {
            get: sinon.stub().callsArgWith(1, new Error('Failed'))
          }
        }
      });
      rs.on('error', function(err) {
        expect(err.message).to.equal('Failed');
        done();
      });
      rs.read();
    });

  });

  describe('#destroy', function() {

    it('should call Sbucket#unlink', function(done) {
      var _unlink = sinon.stub().callsArg(1);
      var rs = new ReadableFileStream({
        fileKey: utils.createReferenceId(),
        sBucket: {
          unlink: _unlink
        }
      });
      rs.destroy(done);
    });

  });

});
