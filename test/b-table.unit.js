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
    var StubbedBtable = proxyquire('../lib/b-table', {
      fs: {
        readFileSync: sinon.stub().returns(
          utils.createReferenceId().toString('hex')
        )
      }
    });

    before(function() {
      _initBtableDirectory = sinon.stub(
        StubbedBtable.prototype,
        '_initBtableDirectory'
      );
      _validateTablePath = sinon.stub(
        StubbedBtable.prototype,
        '_validateTablePath'
      );
    });

    it('should initialize the db if it does not exist', function() {
      var _fileDoesExist = sinon.stub(utils, 'fileDoesExist').returns(false);
      StubbedBtable('');
      _fileDoesExist.restore();
      setImmediate(function() {
        expect(_initBtableDirectory.called).to.equal(true);
      });
    });

    it('should validate the db if it does exist', function() {
      var _fileDoesExist = sinon.stub(utils, 'fileDoesExist').returns(true);
      StubbedBtable('');
      _fileDoesExist.restore();
      setImmediate(function() {
        expect(_validateTablePath.called).to.equal(true);
      });
    });

    it('should throw an error if validating table path fails', function() {
      _validateTablePath.restore();
      _validateTablePath = sinon.stub(
        StubbedBtable.prototype,
        '_validateTablePath'
      ).throws(new Error('Failed'));
      var _fileDoesExist = sinon.stub(utils, 'fileDoesExist').returns(true);
      expect(function() {
        StubbedBtable('');
      }).to.throw(Error, 'Failed');
      _fileDoesExist.restore();
    });

    after(function() {
      _initBtableDirectory.restore();
      _validateTablePath.restore();
    });

  });

  describe('#_initBtableDirectory', function() {

    it('should throw error if mkdirp fails', function() {
      var StubbedBtable = proxyquire('../lib/b-table', {
        mkdirp: {
          sync: sinon.stub().throws(new Error('Failed'))
        }
      });
      expect(function() {
        StubbedBtable.prototype._initBtableDirectory.call({
          _tablePath: 'some/path.kfs'
        });
      }).to.throw(Error, 'Failed');
    });

    it('should write the reference id file and callback', function() {
      var _mkdirp = sinon.stub();
      var _writeFileSync = sinon.stub();
      var StubbedBtable = proxyquire('../lib/b-table', {
        mkdirp: {
          sync: _mkdirp
        },
        fs: {
          writeFileSync: _writeFileSync
        }
      });
      StubbedBtable.prototype._initBtableDirectory.call({
        _tablePath: 'some/path.kfs'
      });
      expect(_mkdirp.called).to.equal(true);
      expect(_writeFileSync.called).to.equal(true);
    });

  });

  describe('#_validateTablePath', function() {

    it('should throw error if not a directory', function() {
      var StubbedBtable = proxyquire('../lib/b-table', {
        fs: {
          statSync: sinon.stub().returns({
            isDirectory: sinon.stub().returns(false)
          })
        }
      });
      expect(function() {
        StubbedBtable.prototype._validateTablePath.call({
          _tablePath: 'some/path.kfs'
        });
      }).to.throw(Error, 'Table path is not a directory');
    });

    it('should throw error if not valid table', function() {
      var StubbedBtable = proxyquire('../lib/b-table', {
        fs: {
          statSync: sinon.stub().returns({
            isDirectory: sinon.stub().returns(true)
          }),
          readdirSync: sinon.stub().returns([])
        }
      });
      expect(function() {
        StubbedBtable.prototype._validateTablePath.call({
          _tablePath: 'some/path.kfs'
        });
      }).to.throw(Error, 'Table path is not a valid KFS instance');
    });

    it('should not throw if valid table', function() {
      var StubbedBtable = proxyquire('../lib/b-table', {
        fs: {
          statSync: sinon.stub().returns({
            isDirectory: sinon.stub().returns(true)
          }),
          readdirSync: sinon.stub().returns([Btable.RID_FILENAME])
        }
      });
      expect(function() {
        StubbedBtable.prototype._validateTablePath.call({
          _tablePath: 'some/path.kfs'
        });
      }).to.not.throw(Error);
    });

  });

  describe('#_getSbucketIndexForKey', function() {

    it('should return the correct xor value', function() {
      expect(
        Btable.prototype._getSbucketIndexForKey.call({
          _rid: Buffer('00', 'hex')
        }, '00')
      ).to.equal(251);
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
