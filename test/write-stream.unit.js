'use strict';

var WritableFileStream = require('../lib/write-stream');
var sinon = require('sinon');
var expect = require('chai').expect;
var utils = require('../lib/utils');

describe('WritableFileStream', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(WritableFileStream({})).to.be.instanceOf(WritableFileStream);
    });

  });

  describe('#_write', function() {

    it('should emit an error if put fails', function(done) {
      var ws = new WritableFileStream({
        fileKey: utils.createReferenceId(),
        sBucket: {
          _db: {
            put: sinon.stub().callsArgWith(2, new Error('Failed'))
          }
        }
      });
      ws.on('error', function(err) {
        expect(err.message).to.equal('Failed');
        done();
      });
      ws.write(Buffer('test'));
    });

  });

  describe('#destroy', function() {

    it('should call Sbucket#unlink', function(done) {
      var _unlink = sinon.stub().callsArg(1);
      var ws = new WritableFileStream({
        fileKey: utils.createReferenceId(),
        sBucket: {
          unlink: _unlink
        }
      });
      ws.destroy(done);
    });

  });

});
