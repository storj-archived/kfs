'use strict';

var Sbucket = require('../lib/s-bucket');
var Btable = require('../lib/b-table');
var expect = require('chai').expect;
var sinon = require('sinon');
var EventEmitter = require('events').EventEmitter;
var utils = require('../lib/utils');
var proxyquire = require('proxyquire');

describe('Btable', function() {

  describe('@constructor', function() {

    var _open;

    before(function() {
      _open = sinon.stub(Btable.prototype, '_open');
    });

    it('should create an instance without the new keyword', function() {
      expect(Btable('')).to.be.instanceOf(Btable);
      expect(Btable('')).to.be.instanceOf(EventEmitter);
    });

    it('should merge options with defaults', function() {
      var bTable = new Btable('some/path', { someOption: true });
      expect(bTable._options.someOption).to.equal(true);
      expect(bTable._options.referenceId).to.equal(null);
    });

    it('should coerce the table path to add extension', function() {
      var bTable = new Btable('some/path');
      expect(bTable._tablePath).to.equal('some/path.kfs');
    });

    it('should create a reference id', function() {
      var bTable = new Btable('');
      expect(Buffer.isBuffer(bTable._rid)).to.equal(true);
    });

    after(function() {
      _open.restore();
    });

  });

  describe('#_open', function() {

    var _initBtableDirectory;
    var _validateTablePath;

    before(function() {
      _initBtableDirectory = sinon.stub(
        Btable.prototype,
        '_initBtableDirectory'
      );
      _validateTablePath = sinon.stub(
        Btable.prototype,
        '_validateTablePath'
      );
    });

    it('should initialize the db if it does not exist', function() {
      var _fileDoesExist = sinon.stub(utils, 'fileDoesExist').returns(false);
      Btable('');
      _fileDoesExist.restore();
      setImmediate(function() {
        expect(_initBtableDirectory.called).to.equal(true);
      });
    });

    it('should validate the db if it does exist', function() {
      var _fileDoesExist = sinon.stub(utils, 'fileDoesExist').returns(true);
      Btable('');
      _fileDoesExist.restore();
      setImmediate(function() {
        expect(_validateTablePath.called).to.equal(true);
      });
    });

    it('should emit an error if validating table path fails', function(done) {
      _validateTablePath.restore();
      _validateTablePath = sinon.stub(
        Btable.prototype,
        '_validateTablePath'
      ).callsArgWith(0, new Error('Failed'));
      var _fileDoesExist = sinon.stub(utils, 'fileDoesExist').returns(true);
      var bTable = new Btable('');
      bTable.on('error', function(err) {
        _fileDoesExist.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    after(function() {
      _initBtableDirectory.restore();
      _validateTablePath.restore();
    });

  });

  describe('#_initBtableDirectory', function() {

    it('should callback error if mkdirp fails', function(done) {
      var StubbedBtable = proxyquire('../lib/b-table', {
        mkdirp: sinon.stub().callsArgWith(1, new Error('Failed'))
      });
      StubbedBtable.prototype._initBtableDirectory.call({
        _tablePath: 'some/path.kfs'
      }, function(err) {
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should write the reference id file and callback', function(done) {
      var StubbedBtable = proxyquire('../lib/b-table', {
        mkdirp: sinon.stub().callsArg(1),
        fs: {
          writeFile: sinon.stub().callsArg(3)
        }
      });
      StubbedBtable.prototype._initBtableDirectory.call({
        _tablePath: 'some/path.kfs'
      }, done);
    });

  });

  describe('#_validateTablePath', function() {

    it('should callback error if not a directory', function(done) {
      var StubbedBtable = proxyquire('../lib/b-table', {
        fs: {
          statSync: sinon.stub().returns({
            isDirectory: sinon.stub().returns(false)
          })
        }
      });
      StubbedBtable.prototype._validateTablePath.call({
        _tablePath: 'some/path.kfs'
      }, function(err) {
        expect(err.message).to.equal('Table path is not a directory');
        done();
      });
    });

    it('should callback error if not valid table', function(done) {
      var StubbedBtable = proxyquire('../lib/b-table', {
        fs: {
          statSync: sinon.stub().returns({
            isDirectory: sinon.stub().returns(true)
          }),
          readdirSync: sinon.stub().returns([])
        }
      });
      StubbedBtable.prototype._validateTablePath.call({
        _tablePath: 'some/path.kfs'
      }, function(err) {
        expect(err.message).to.equal('Table path is not a valid KFS instance');
        done();
      });
    });

    it('should callback if valid table', function(done) {
      var StubbedBtable = proxyquire('../lib/b-table', {
        fs: {
          statSync: sinon.stub().returns({
            isDirectory: sinon.stub().returns(true)
          }),
          readdirSync: sinon.stub().returns([Btable.RID_FILENAME])
        }
      });
      StubbedBtable.prototype._validateTablePath.call({
        _tablePath: 'some/path.kfs'
      }, function(err) {
        expect(err).to.equal(null);
        done();
      });
    });

  });

  describe('#_getSbucketIndexForKey', function() {

    it('should return the correct xor value', function() {
      expect(
        Btable.prototype._getSbucketIndexForKey.call({
          _rid: Buffer('00', 'hex')
        }, '00')
      ).to.equal(0);
    });

  });

  describe('#_getSbucketAtIndex', function() {

    it('should return the existing sBucket', function() {
      var _sBucket = new EventEmitter();
      var sBucket = Btable.prototype._getSbucketAtIndex.call({
        _sBuckets: { 0: _sBucket }
      }, 0);
      expect(sBucket).to.equal(_sBucket);
    });

    it('should create a new sBucket at the index', function() {
      var StubbedBtable = proxyquire('../lib/b-table', {
        './s-bucket': EventEmitter
      });
      var sBucket = StubbedBtable.prototype._getSbucketAtIndex.call({
        _sBuckets: {},
        _tablePath: 'some/path.kfs',
        _options: { sBucketOpts: {} }
      }, 0);
      expect(sBucket).to.be.instanceOf(EventEmitter);
    });

  });

  describe('#_getSbucketForKey', function() {

    it('should callback with the sBucket if opened', function(done) {
      var sBucket = new EventEmitter();
      sBucket.readyState = Sbucket.OPENED;
      var _getSbucketAtIndex = sinon.stub(
        Btable.prototype,
        '_getSbucketAtIndex'
      ).returns(sBucket);
      var _open = sinon.stub(Btable.prototype, '_open');
      var bTable = new Btable('');
      bTable._getSbucketForKey('0f0f', function(err, s) {
        _getSbucketAtIndex.restore();
        _open.restore();
        expect(s).to.equal(sBucket);
        done();
      });
    });

    it('should callback with error if opening sBucket fails', function(done) {
      var sBucket = new EventEmitter();
      sBucket.readyState = Sbucket.CLOSED;
      sBucket.open = sinon.stub().callsArgWith(0, new Error('Failed'));
      var _getSbucketAtIndex = sinon.stub(
        Btable.prototype,
        '_getSbucketAtIndex'
      ).returns(sBucket);
      var _open = sinon.stub(Btable.prototype, '_open');
      var bTable = new Btable('');
      bTable._getSbucketForKey('0f0f', function(err) {
        _getSbucketAtIndex.restore();
        _open.restore();
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should callback when sBucket is opened', function(done) {
      var sBucket = new EventEmitter();
      sBucket.readyState = Sbucket.CLOSED;
      sBucket.open = sinon.stub().callsArgWith(0);
      var _getSbucketAtIndex = sinon.stub(
        Btable.prototype,
        '_getSbucketAtIndex'
      ).returns(sBucket);
      var _open = sinon.stub(Btable.prototype, '_open');
      var bTable = new Btable('');
      bTable._getSbucketForKey('0f0f', function(err, s) {
        _getSbucketAtIndex.restore();
        _open.restore();
        expect(err).to.equal(null);
        expect(s).to.equal(sBucket);
        done();
      });
    });

  });

});
