'use strict';

var proxyquire = require('proxyquire');
var Sbucket = proxyquire('../lib/s-bucket', { leveldown: require('memdown') });
var expect = require('chai').expect;
var sinon = require('sinon');
var stream = require('readable-stream');
var utils = require('../lib/utils');

describe('Sbucket', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(Sbucket('test')).to.be.instanceOf(Sbucket);
    });

  });

  describe('#open', function() {



  });

  describe('#close', function() {



  });

  describe('#unlink', function() {



  });

  describe('#readFile', function() {

    it('should callback with error if read stream fails', function(done) {
      var sBucket = new Sbucket('test');
      var _rs = new stream.Readable({ read: utils.noop });
      var _createReadStream = sinon.stub(
        sBucket,
        'createReadStream'
      ).returns(_rs);
      sBucket.readFile(utils.createReferenceId(), function(err) {
        _createReadStream.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
      setImmediate(function() {
        _rs.emit('error', new Error('Failed'));
      });
    });

  });

  describe('#writeFile', function() {

    it('should callback with error if write stream fails', function(done) {
      var sBucket = new Sbucket('test');
      var _ws = new stream.Writable({ write: utils.noop });
      var _createWriteStream = sinon.stub(
        sBucket,
        'createWriteStream'
      ).returns(_ws);
      sBucket.writeFile(
        utils.createReferenceId(),
        Buffer('test'),
        function(err) {
          _createWriteStream.restore();
          expect(err.message).to.equal('Failed');
          done();
        }
      );
      setImmediate(function() {
        _ws.emit('error', new Error('Failed'));
      });
    });

  });

  describe('#stat', function() {

    it('should callback with error if fails to get size', function(done) {
      var sBucket = new Sbucket('test');
      var _approximateSize = sinon.stub(
        sBucket._db,
        'approximateSize'
      ).callsArgWith(2, new Error('Failed'));
      sBucket.stat(function(err) {
        _approximateSize.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

  });

});
