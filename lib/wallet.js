'use strict';
var bitcore = require('bitcore'),
    Mnemonic = require('bitcore-mnemonic'),
    EventEmitter = require('events').EventEmitter,
    util = require('util');

function Wallet(options) {
  if (!(this instanceof Wallet))
    return new Wallet(options, passphrase);

  this.options = options || {};

  // Default/fallback to ENGLISH
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
}
util.inherits(Wallet, EventEmitter);

Wallet.prototype._init = function() {
  // TODO: Load from storage if already stored
  var mnemonic = new Mnemonic(this.language);
  this.key.mnemonic = mnemonic.toString();
  this.key.priv = mnemonic.toHDPrivateKey();
  this.key.pub = this.key.priv.hdPublicKey;
  this.loaded = true;
  this.emit('load');
}

Wallet.prototype.balance = function () {
}

Wallet.prototype.mnemonic = function () {
}

Wallet.prototype.fromJSON = function() {
}

Wallet.prototype.toJSON = function() {
  return {
    type: 'wallet',
    pub: this.key.pub.xpubkey,
    priv: this.key.priv.toString()
  }
}

// load - when wallet is loaded
// locked - when wallet 'times out' the master public key to erase from memory
Wallet.Events = ['load', 'locked'];

module.exports = Wallet;
