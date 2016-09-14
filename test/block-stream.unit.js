'use strict';

var BlockStream = require('../lib/block-stream');
var expect = require('chai').expect;

describe('BlockStream', function() {

  describe('@constructor', function() {

    it('should create an instance without the new keyword', function() {
      expect(BlockStream()).to.be.instanceOf(BlockStream);
    });

  });

  describe('#_flush', function() {

    it('should pad the last chunk with zeros', function(done) {
      var bs = new BlockStream({ chunkSize: 12, padLastChunk: true });
      var buf = Buffer([]);
      bs.on('data', function(data) {
        buf = Buffer.concat([buf, data]);
      });
      bs.on('end', function() {
        expect(buf).to.have.lengthOf(24);
        expect(Buffer.compare(buf.slice(18), Buffer(6).fill(0))).to.equal(0);
        done();
      });
      bs.write(Buffer(6).fill(1));
      bs.write(Buffer(6).fill(1));
      bs.write(Buffer(6).fill(1));
      bs.end();
    });

  });

});
