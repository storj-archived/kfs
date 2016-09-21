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

    it('should emit an error if open fails', function(done) {
      var sBucket = new Sbucket('');
      var _open = sinon.stub(
        sBucket._db,
        'open'
      ).callsArgWith(1, new Error('Failed'));
      sBucket.open(function(err) {
        _open.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should not require a callback', function(done) {
      var sBucket = new Sbucket('');
      sBucket.on('open', done);
      setImmediate(function() {
        sBucket.open();
      });
    });

    it('should emit open if already opened', function(done) {
      var sBucket = new Sbucket('');
      sBucket.readyState = Sbucket.OPENED;
      sBucket.open(done);
    });

    it('should return if open in progress', function(done) {
      var sBucket = new Sbucket('');
      sBucket.readyState = Sbucket.OPENING;
      sBucket.open(done);
      setImmediate(function() {
        sBucket.emit('open');
      });
    });

    it('should wait until close if closing', function(done) {
      var sBucket = new Sbucket('');
      sBucket.readyState = Sbucket.CLOSING;
      sBucket.open(done);
      setImmediate(function() {
        sBucket.emit('close');
      });
    });

  });

  describe('#close', function() {

    it('should emit an error if close fails', function(done) {
      var sBucket = new Sbucket('');
      sBucket.readyState = Sbucket.OPENED;
      var _close = sinon.stub(
        sBucket._db,
        'close'
      ).callsArgWith(0, new Error('Failed'));
      sBucket.close(function(err) {
        _close.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should not require a callback', function(done) {
      var sBucket = new Sbucket('');
      var _close = sinon.stub(
        sBucket._db,
        'close'
      ).callsArgWith(0);
      sBucket.readyState = Sbucket.OPENED;
      sBucket.on('close', done);
      setImmediate(function() {
        sBucket.close();
        _close.restore();
      });
    });

    it('should emit close if already closed', function(done) {
      var sBucket = new Sbucket('');
      var _close = sinon.stub(
        sBucket._db,
        'close'
      ).callsArgWith(0);
      sBucket.close(function() {
        _close.restore();
        done();
      });
    });

    it('should return if close in progress', function(done) {
      var sBucket = new Sbucket('');
      var _close = sinon.stub(
        sBucket._db,
        'close'
      ).callsArgWith(0);sBucket.readyState = Sbucket.CLOSING;
      sBucket.close(done);
      setImmediate(function() {
        sBucket.emit('close');
        _close.restore();
      });
    });

    it('should wait until open if opening', function(done) {
      var sBucket = new Sbucket('');
      var _close = sinon.stub(
        sBucket._db,
        'close'
      ).callsArgWith(0);sBucket.readyState = Sbucket.OPENING;
      sBucket.close(done);
      setImmediate(function() {
        sBucket.emit('open');
        _close.restore();
      });
    });

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

  describe('#_checkIdleState', function() {

    it('should emit the idle event if idle for 60000ms', function(done) {
      var sBucket = new Sbucket('test');
      var clock = sinon.useFakeTimers();
      sBucket._checkIdleState();
      sBucket.once('idle', done);
      clock.tick(60000);
      clock.restore();
    });

  });

  describe('#_emitIfStateIsIdle', function() {

    it('should emit the idle event if idle', function() {
      var sBucket = new Sbucket('test');
      expect(sBucket._emitIfStateIsIdle()).to.equal(true);
    });

    it('should not emit the idle event if not idle', function() {
      var sBucket = new Sbucket('test');
      sBucket._incPendingOps();
      expect(sBucket._emitIfStateIsIdle()).to.equal(false);
    });

  });

  describe('#_incPendingOps', function() {

    it('should increment the _pendingOperations property', function() {
      var sBucket = new Sbucket('test');
      sBucket._incPendingOps();
      expect(sBucket._pendingOperations).to.equal(1);
    });

  });

  describe('#_decPendingOps', function() {

    it('should decrement the _pendingOperations property', function() {
      var sBucket = new Sbucket('test');
      sBucket._pendingOperations = 1;
      sBucket._decPendingOps();
      expect(sBucket._pendingOperations).to.equal(0);
    });

  });

});
