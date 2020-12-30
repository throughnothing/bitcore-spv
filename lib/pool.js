'use strict';
var P2P = require('bitcore-p2p');
var Peer = P2P.Peer;
var bitcore = require('bitcore-lib');
var BlockHeader = bitcore.BlockHeader;
var EventEmitter = require('events').EventEmitter;
var BloomFilter = P2P.BloomFilter;

var Chain = require('./chain');
var constants = require('./constants');
var utils = require('./utils');

var assert = require('assert');


function Pool(options) {
  if (!(this instanceof Pool))
    return new Pool(options);

  this.options = options || {};
  this.options.peerTimeout = this.options.peerTimeout || 3000;
  this.options.relay = this.options.relay !== false;
  this.size = this.options.size || 3;
  this.network = bitcore.Networks[this.options.network]
    || bitcore.Networks.defaultNetwork;
  this.connected = false;
  this.chain = null;
  this.pool = null;
  this.ping = {
    interval: this.options.pingInterval || 30000,
    _timers: []
  }
  this.peers = {
    loader: null,
    pending: [],
    connected: []
  };
}
utils.inherits(Pool, EventEmitter);

Pool.prototype.connect = function() {
  if(this.connected) return;

  // TODO: pass in options to the pool?
  this.pool = new P2P.Pool(this.network, { maxSize: this.size });
  // TODO: pass in options (storage, etc.) to the Chain?
  this.chain = new Chain({ network: this.network });
  this.pool.on('peerconnect', this._handlePeerConnect.bind(this));
  this.pool.on('peerready', this._handlePeerReady.bind(this));
  this.pool.on('peerdisconnect', this._handlePeerDisconnect.bind(this));
  this.pool.on('peerheaders', this._handlePeerHeaders.bind(this));
  this.pool.on('peerinv', this._handlePeerInv.bind(this));
  this.pool.on('peererror', this._handlePeerError.bind(this));

  this.pool.connect();
  this.connected = true;

  // TODO: figure out why this is needed
  var poolTimeout = setTimeout(function(){
    this.disconnect().connect();
  }.bind(this),3000);
  this.pool.once('peerready', function() { clearTimeout(poolTimeout); });

  return this;
}

Pool.prototype.disconnect = function() {
  this.connected=false;
  this.pool.disconnect();
  return this;
}

Pool.prototype.watch = function(id) {
  // id can be a bitcoir 'Address' or a String, (or an HD public key?)
  // TODO Set/Update BloomFilter
}

Pool.prototype._setLoaderPeer = function(peer) {
  var self = this;
  if(!this.chain.loaded) {
    this.chain.once('load',function() { self._setLoaderPeer(peer) });
    return;
  }
  if(!peer && self.peers.connected.length) {
    // TODO: make it choose randomly
    peer = self.peers.connected[0];
  } else if(!peer || this.peers.loader) {
    // Have no connected peers, need to wait
    return;
  }
  this.emit('set-loader-peer');
  this.peers.loader = peer;
  var lastHashIdx = this.chain.index.hashes.length - 1;
  // TODO: move this to an on('set-loader-peer') instead of being in here
  peer.sendMessage(new peer.messages.GetHeaders([this.chain.index.hashes[lastHashIdx]]));
}

Pool.prototype._handlePeerConnect = function(peer) {
  this.peers.pending.push(peer);
  // Only wait 3 seconds for verAck
  var peerTimeout = setTimeout(function() {
    peer.disconnect();
  },3000);
  peer.on('ready', function() { clearTimeout(peerTimeout); });
  peer.on('disconnect', function() { clearTimeout(peerTimeout); });
  this.emit('peer-connect', peer)
}

Pool.prototype._handlePeerReady = function(peer, addr) {
  this._removePeer(peer);
  this.peers.connected.push(peer);
  this.emit('peer-ready', peer);

  // Setup a ping interval
  // TODO: not ideal to stick this on the peer object
  // But its the simplest for now
  peer._pingTimer = (setInterval(function(){
    peer.sendMessage(peer.messages.Ping());
  },this.ping.interval));

  //TODO: Smarter loader peer choosing
  if(!this.peers.loader) {
    this._setLoaderPeer(peer);
  }
}

Pool.prototype._handlePeerDisconnect = function(peer, addr) {
  if (peer instanceof Peer) {
    this._removePeer(peer);
    clearInterval(peer._pingTimer);
    this.emit('peer-disconnect', peer);
  }
}

Pool.prototype._handlePeerInv = function(peer, message) {
  var txHashes = [], blockHashes = [];
  if(message.count > constants.MAX_GETDATA_HASHES) {
    console.log('inv message has too many items, dropping.');
    return;
  }

  for(var i in message.inventory) {
    switch(message.inventory[i].type) {
      case 1: // TX
        txHashes.push(message.inventory[i]);
      break;
      case 2: // Block
        blockHashes.push(message.inventory[i]);
      break;
      default: break;
    }
  }

  // Stole this logic from breadWallet
  if(txHashes.length > 10000) {
    console.log('too many transactions, disconnecting from peer');
    peer.disconnect();
    return;
  }

  // If we got new blocks, GetHeaders
  if(blockHashes.length) {
    var lastHashIdx = this.chain.index.hashes.length - 1;
    peer.sendMessage(new peer.messages.GetHeaders([this.chain.index.hashes[lastHashIdx]]));
  }
}

Pool.prototype._handlePeerHeaders = function(peer, message) {
  for(var i in message.headers) {
    var blockHeader = new BlockHeader(message.headers[i]);
    this.chain.add(blockHeader);
  }

  this.emit('chain-progress', this.chain.fillPercent());

  // If we got 2000 messages, assume we still have more to get
  if(message.headers.length == 2000) {
    var lastHeader = message.headers[message.headers.length - 1];
    peer.sendMessage(new peer.messages.GetHeaders([lastHeader.id]));
  } else {
    this.emit('chain-full');
  }
}

Pool.prototype._handlePeerReject = function(peer, message) {
  this.emit('peer-reject', message);
}

Pool.prototype._handlePeerError = function(peer, e) {
  this.emit('peer-error');
  peer.disconnect();
}

Pool.prototype._removePeer = function(peer) {
  var i = this.peers.pending.indexOf(peer);
  if (i !== -1) {
    this.peers.pending.splice(i, 1);
  }

  i = this.peers.connected.indexOf(peer);
  if (i !== -1) {
    this.peers.connected.splice(i, 1);
  }

  if (this.peers.loader === peer) {
    this.peers.load = null;
  }
}

Pool.Events = [
  'chain-progress','chain-full', 'peer-error', 'peer-reject',
  'peer-connect','peer-disconnect', 'peer-ready', 'set-loader-peer'
];

module.exports = Pool;
