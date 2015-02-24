'use strict';
var P2P = require('bitcore-p2p');
var Peer = P2P.Peer;
var Messages = P2P.Messages;
var bitcore = require('bitcore');
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
  this.bloom = null;
  this.bloom = BloomFilter.create(1, 0.0001, 0, BloomFilter.BLOOM_UPDATE_ALL);
  // If this is set, we can utilize GetHeaders up to the earliestKeyTime
  // To speed up chain syncing, especially in the beginning
  this.earliestKeyTime = this.options.earliestKeyTime || null;
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
  var self = this;
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
  this.pool.on('peermerkleblock', this._handlePeerBlock.bind(this));
  this.pool.on('peerblock', this._handlePeerBlock.bind(this));

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

// TODO txIds should be able to  be a list of Transactions  or a String
Pool.prototype.watch = function(txIds) {
  var self = this;

  for(var i = 0; i < txIds.length; i++) {
    var idBuf = new Buffer(txIds[i], 'hex');
    // Don't need to re-insert if we already match
    if(!this.bloom.contains(idBuf)) {
      this.bloom.insert(new Buffer(txIds[i], 'hex'));
    }
  }

  if(this.peers.loader) {
    this._updateFilter(self.peers.loader);
  } else {
    this.once('set-loader-peer', function() {
      self._updateFilter(self.peers.loader);
    });
  }
  // update all pending peers
  for(var i = 0; i < this.peers.pending.length; i++) {
    this._updateFilter(this.peers.pending[i]);
  }
}

Pool.prototype._updateFilter = function(peer) {
  var self = this;
  if(peer.status !== Peer.STATUS.READY) {
    peer.once('ready', function() { self._updateFilter(peer) });
    return;
  }
  if(!this.chain.index.lastHash) {
    this.chain.once('load', function() { self._updateFilter(peer) });
    return;
  }

  this._send(new Messages.FilterLoad(this.bloom), peer);
  if(!this.relay) {
    this._send(new Messages.GetBlocks([this.chain.index.lastHash],0), peer);
  }
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
  this.peers.loader = peer;
  this.emit('set-loader-peer', peer);

  //TODO: Probably do this somewhere else
  console.log('getting blocks to catch up...',
    'latestBlock',this.chain.index.lastHash,
    'Height', this.chain.index.lastHeight);
  this._send(new Messages.GetBlocks([this.chain.index.lastHash]), peer);
}

Pool.prototype._handlePeerConnect = function(peer) {
  this.peers.pending.push(peer);
  // Only wait 3 seconds for verAck
  var peerTimeout = setTimeout(function() {
    peer.disconnect();
  },3000);
  peer.on('ready', function() { clearTimeout(peerTimeout); });
  this.emit('peer-connect', peer)
}

Pool.prototype._handlePeerReady = function(peer, addr) {
  this._removePeer(peer);
  this.peers.connected.push(peer);
  this.emit('peer-ready', peer);

  // Setup a ping interval
  // TODO: not ideal to stick this on the peer object
  // But its the simplest for now
  var self = this;
  peer._pingTimer = (setInterval(function(){
    self._send(new Messages.Ping(), peer);
  },this.ping.interval));

  //TODO: Smarter loader peer choosing
  if(!this.peers.loader) {
    this._setLoaderPeer(peer);
  }
}

Pool.prototype._handlePeerDisconnect = function(peer, addr) {
  this._removePeer(peer);
  clearInterval(peer._pingTimer);
  this.emit('peer-disconnect', peer)
}

Pool.prototype._handlePeerBlock = function(peer, message) {
  this.chain.add(message.block);
  this.emit('chain-progress', this.chain.fillPercent());
  this.emit('peer-block', peer, message);
}

Pool.prototype._handlePeerInv = function(peer, message) {
  var txHashes = [];
  var blockHashes = [];
  var merkleBlockHashes = [];

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
      case 3: // Block
        blockHashes.push(message.inventory[i]);
        break;
      break;
      default: break;
    }
  }

  if(blockHashes.length > 0) {
    console.log('Inv blocks', blockHashes.length);
  }

  // Stole this logic from breadWallet
  if(txHashes.length > 10000) {
    console.log('too many transactions, disconnecting from peer');
    peer.disconnect();
    return;
  }

  if(blockHashes.length) {
    for(var i = 0; i < blockHashes.length; i++) {
      this._send(new Messages.GetData([blockHashes[i]]));
    }
  }
}

Pool.prototype._handlePeerHeaders = function(peer, message) {
  for(var i = 0; i < message.headers; i++) {
    this.chain.add(message.headers[i]);
  }
  this.emit('chain-progress', this.chain.fillPercent());
  // If we got 2000 messages, assume we still have more to get
  if(message.headers.length == 2000) {
    var lastHeader = message.headers[message.headers.length - 1];
    this._send(new Messages.GetHeaders([lastHeader.id]), peer);
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

// If not given a peer, it'll send the message to a random connected peer
Pool.prototype._send = function(message, peer) {
  var numPeers = this.peers.connected.length;
  peer = peer || this.peers.connected[Math.floor(Math.random() * numPeers)];
  peer.sendMessage(message);
}

Pool.Events = [
  'chain-progress','chain-full', 'peer-error', 'peer-reject',
  'peer-connect','peer-disconnect', 'peer-ready', 'set-loader-peer'
];

module.exports = Pool;
