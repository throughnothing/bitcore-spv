'use strict';
var bitcore = require('bitcore');
var Mnemonic = require('bitcore-mnemonic');
var EventEmitter = require('events').EventEmitter;

var utils = require('./utils');

function Wallet(options) {
  if (!(this instanceof Wallet))
    return new Wallet(options, passphrase);

  this.options = options || {};
  this.language = Mnemonic.Words[this.options.language] || Mnemonic.Words.ENGLISH;
  this.loaded = false;
  this.key = {
    priv: null,
    pub: null,
    mnemonic: null,
    // TODO: make use of password (maybe make it non-optional?)
    passphrase: this.options.passphrase || null
  };
  this.masterPrivateKey = null;
  // Delete the passphrase when we're done with it
  delete this.options['passphrase'];

  this._init();
};
utils.inherits(Wallet, EventEmitter);

Wallet.prototype._init = function() {
  // TODO: Load from storage if already stored
  var mnemonic = new Mnemonic(this.language);
  this.key.mnemonic = mnemonic.toString();
  this.key.priv = mnemonic.toHDPrivateKey();
  this.key.pub = this.key.priv.hdPublicKey;
  this.loaded = true;
  this.emit('load');
};

Wallet.prototype.balance = function () {
};

Wallet.prototype.mnemonic = function () {
};

Wallet.prototype.fromJSON = function() {
};

Wallet.prototype.fromJSON = function(json) {
  if(typeof json === 'string') {
    json = JSON.parse(json);
  }
  utils.assert.equal(json.version, 1);
  utils.assert.equal(json.type, 'wallet');
  // TODO
};

Wallet.prototype.toJSON = function() {
  return {
    version: 1,
    type: 'wallet',
    pub: this.key.pub.xpubkey,
    priv: this.key.priv.toString()
  }
};

// load - when wallet is loaded
Wallet.Events = ['load'];

module.exports = Wallet;
