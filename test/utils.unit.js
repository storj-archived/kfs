'use strict';

var expect = require('chai').expect;
var utils = require('../lib/utils');

describe('@module:kfs/utils', function() {

  describe('#noop', function() {

    it('should return undefined', function() {
      expect(utils.noop()).to.equal(undefined);
    });

  });

  describe('#isValidKey', function() {

    it('should return false for invalid key', function() {
      expect(utils.isValidKey({})).to.equal(false);
    });

  });

  describe('#toHumanReadableSize', function() {

    it('should covert the bytes to a human readable size', function() {
      expect(utils.toHumanReadableSize(34359738368)).to.equal('32.0 GiB');
    });

    it('should return the bytes if lower than 1KiB', function() {
      expect(utils.toHumanReadableSize(1000)).to.equal('1000 B');
    });

  });

  describe('#coerceKey', function() {

    it('should return the valid key', function() {
      var key = utils.createReferenceId();
      expect(utils.coerceKey(key)).to.equal(key);
    });

    it('should return the hash of the invalid key', function() {
      expect(utils.coerceKey('test')).to.equal(
        'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'
      );
    });

  });

  describe('#createItemKeyFromIndex', function() {

    it('should return the correct item key', function() {
      var fileKey = 'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc';
      var itemKey = utils.createItemKeyFromIndex(fileKey, 20);
      expect(itemKey).to.equal(
        'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc 000020'
      );
    });

  });

  describe('#createSbucketNameFromIndex', function() {

    it('should return the correct sBucket dirname', function() {
      expect(utils.createSbucketNameFromIndex(42)).to.equal('042.s');
    });

  });

  describe('#createReferenceId', function() {

    it('should generate a new reference id if none supplied', function() {
      expect(utils.createReferenceId()).to.have.lengthOf(20);
    });

    it('should return a hex buffer from the given rid', function() {
      var rid = utils.createReferenceId(
        'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc'
      );
      expect(Buffer.isBuffer(rid)).to.equal(true);
      expect(rid).to.have.lengthOf(20);
      expect(rid.toString('hex')).to.equal(
        'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc'
      );
    });

  });

  describe('#fileDoesExist', function() {

    it('should return true if file exists', function() {
      expect(utils.fileDoesExist(__dirname)).to.equal(true);
    });

    it('should return false if file does not exist', function() {
      expect(utils.fileDoesExist(
        utils.createReferenceId().toString('hex')
      )).to.equal(false);
    });

  });

  describe('#coerceTablePath', function() {

    it('should add the .kfs extension if not supplied', function() {
      expect(utils.coerceTablePath('test')).to.equal('test.kfs');
    });

    it('should not add the .kfs extension if it is supplied', function() {
      expect(utils.coerceTablePath('test.kfs')).to.equal('test.kfs');
    });

  });

});
