'use strict';
var chai = require('chai');
var expect = chai.expect;
var should = chai.should();
var BlockHeader = require('bitcore-lib').BlockHeader;

var Chain = require('..').Chain;
var constants = require('..').constants;
var shortChain = require('./data/chain-short');


describe('Chain', function() {

  describe('Constructor', function() {
    it('instantiates with no args',function () {
      var c = new Chain();
    });
  });

  describe('#toJSON', function() {
    it('valid JSON',function () {
      var c = new Chain();
      var json = c.toJSON();
      json.version.should.equal(1);
      json.type.should.equal('chain');
      expect(json.hashes.should.be.a('array'));
      expect(json.heights.should.be.a('array'));
      expect(json.ts.should.be.a('array'));
    });
  });

  describe('#fromJSON', function() {
    it('valid JSON string non-prototype',function () {
      var json = JSON.stringify(shortChain);
      var c = Chain.fromJSON(json);
      c.index.hashes.should.deep.equal(shortChain.hashes);
      c.index.ts.should.deep.equal(shortChain.ts);
      c.index.heights.should.deep.equal(shortChain.heights);
      c.lastTsAtLoad.should.equal(shortChain.ts[shortChain.ts.length-1]);
    });

    it('valid JSON string prototype',function () {
      var json = JSON.stringify(shortChain);
      var c = new Chain();
      c.fromJSON(json);
      c.index.hashes.should.deep.equal(shortChain.hashes);
      c.index.ts.should.deep.equal(shortChain.ts);
      c.index.heights.should.deep.equal(shortChain.heights);
      c.lastTsAtLoad.should.equal(shortChain.ts[shortChain.ts.length-1]);
    });

    it('valid JSON object non-prototype',function () {
      var c = Chain.fromJSON(shortChain);
      c.index.hashes.should.deep.equal(shortChain.hashes);
      c.index.ts.should.deep.equal(shortChain.ts);
      c.index.heights.should.deep.equal(shortChain.heights);
      c.lastTsAtLoad.should.equal(shortChain.ts[shortChain.ts.length-1]);
    });

    it('valid JSON object prototype',function () {
      var c = new Chain()
      c.fromJSON(shortChain);
      c.index.hashes.should.deep.equal(shortChain.hashes);
      c.index.ts.should.deep.equal(shortChain.ts);
      c.index.heights.should.deep.equal(shortChain.heights);
      c.lastTsAtLoad.should.equal(shortChain.ts[shortChain.ts.length-1]);
    });

    it('uses genesis block no valid empty JSON',function () {
      var c = Chain.fromJSON({
        version: 1, type: 'chain', hashes: [], heights: [], ts: [] });

      var genesisBlock = BlockHeader.fromJSON(constants.GENESIS_BLOCK);
      c.index.heights.should.deep.equal([0]);
      c.index.hashes.should.deep.equal([genesisBlock.id]);
      c.index.ts.should.deep.equal([genesisBlock.time]);
      c.lastTsAtLoad.should.equal(genesisBlock.time);
    });

    it('invalid JSON',function () {
      shortChain.version = 2;
      expect(function(){ Chain.fromJSON(shortChain); })
        .to.throw(/2 == 1/);
      shortChain.version = 1;
      shortChain.type = 'wallet';
      expect(function(){ Chain.fromJSON(shortChain); })
        .to.throw(/wallet/);
      shortChain.type = 'chain';
    });
  });

});
