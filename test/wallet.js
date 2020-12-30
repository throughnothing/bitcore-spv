'use strict';
var chai = require('chai');
var expect = chai.expect;
var should = chai.should();

var Wallet = require('..').Wallet;

describe('Wallet', function() {

  describe('Constructor', function() {
    it('instantiates with no args',function () {
      var w = new Wallet();
    });
  });

  describe('#toJSON', function() {
    it('valid JSON',function () {
      var w = new Wallet();
      var json = w.toJSON();
      json.version.should.equal(1);
      json.type.should.equal('wallet');
      expect(json.pub.should.be.a('string'));
      expect(json.priv.should.be.a('string'));
    });
  });

  describe('#fromObject', function() {
    // TODO
  });

});
