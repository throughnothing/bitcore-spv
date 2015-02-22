'use script';
var EventEmitter = require('events').EventEmitter,
    bitcore = require('bitcore'),
    BlockHeader = bitcore.BlockHeader,
    bufferUtil = bitcore.util.buffer,
    util = require('util');

var constants = require('./constants'),
    data = require('./data');

function Chain(options) {
  if (!(this instanceof Chain))
    return new Chain(options);

  this.options = options || {};
  // TODO: Force the Chain to do a full sync from the genesis block, even
  // if it has stored state/indexes
  this.forceFullSync = this.options.forceFullSync !== false;
  this.network = this.options.network || bitcore.Networks.defaultNetwork;
  this.blocks = {
    list: [],
    last: null
  };
  this.index = {
    hashes: [],
    heights: [],
    ts: [],
    lastHash: null,
    lastTs: 0,
    lastHeight: 0,
  };
  this.lastTsAtLoad = 0;
  this.orphans = [];
  this.loaded = false;

  this._load();
}
util.inherits(Chain, EventEmitter);

Chain.prototype._load = function() {
  this.fromJSON(data);
  this.index.lastHash = this.index.hashes[this.index.hashes.length-1];
  this.index.lastHeight = this.index.heights[this.index.heights.length-1];
  this.index.lastTs = this.index.ts[this.index.ts.length-1];
  this.lastTsAtLoad = this.index.lastTs;
  this.loaded = true;
  this.emit('load');
}

Chain.prototype.add = function(block) {
  if(!this.loaded) {
    this.once('load', function() { this.add(block) });
  }
  // TODO: This won't handle chain forks, it'll just accept the first
  // valid proof on top of the current chain.  It won't be able to find
  // another chain that grows longer than the first one seen.
  if(block.validProofOfWork()) {
    var prevHash = bufferUtil.reverse(block.prevHash).toString('hex');
    if (prevHash == this.index.lastHash) {
      this.blocks.list.push(block);
      this.blocks.last = block;

      // TODO: this is inaccurate, but works for now, will need to be refactored
      this.index.hashes.push(block.id);
      this.index.ts.push(block.time);
      this.index.heights
        .push(this.index.heights[this.index.heights.length-1] + 1);

      this.index.lastHash = this.index.hashes[this.index.hashes.length-1];
      this.index.lastHeight = this.index.heights[this.index.heights.length-1];
      this.index.lastTs = this.index.ts[this.index.ts.length-1];
    } else {
      this.orphans.push(block)
    }
  }
}

Chain.prototype.estimatedBlockHeight = function() {
  // Estimate 10 minutes per block
  return this.index.lastHeight +
    Math.floor((+new Date() / 1000 - this.index.lastTs)/(10*60));
}

Chain.prototype.fillPercent = function() {
  // Simpler way?
  //return this.index.lastHeight / this.estimatedBlockHeight();
  // from bcoin
  var total = (+new Date() / 1000 - 40 * 60) - this.lastTsAtLoad;
  var current = this.index.lastTs - this.lastTsAtLoad;
  return Math.max(0, Math.min(current / total, 1));
}

Chain.prototype.timestampForBlockHeight = function(blockHeight) {
  // TODO:
  //if (blockHeight > this.syncedBlockHeight()) {
  //// future block, assume 10 minutes per block after last block
  //return this.lastBlock.timestamp + (blockHeight - this.lastBlockHeight)*10*60;
  //}
}

// This is from bcoin
Chain.prototype.toJSON = function() {
  var keep = 1000;

  // Keep only last 1000 consequent blocks, dilate others at:
  // 7 day range for blocks before 2013
  // 12 hour for blocks before 2014
  // 6 hour for blocks in 2014 and after it
  // (or at maximum 250 block range)
  var last = {
    hashes: this.index.hashes.slice(-keep),
    ts: this.index.ts.slice(-keep),
    heights: this.index.heights.slice(-keep)
  };

  var first = {
    hashes: [],
    ts: [],
    heights: []
  };

  var delta1 = 7 * 24 * 3600;
  var delta2 = 12 * 3600;
  var delta3 = 6 * 3600;

  var lastTs = 0;
  var lastHeight = -1000;
  for (var i = 0; i < this.index.ts.length - keep; i++) {
    var ts = this.index.ts[i];
    var delta = ts < 1356984000 ? delta1 :
                ts < 1388520000 ? delta2 : delta3;
    var hdelta = this.index.heights[i] - lastHeight;
    if (ts - lastTs < delta && hdelta < 250)
      continue;

    lastTs = ts;
    lastHeight = this.index.heights[i];
    first.hashes.push(this.index.hashes[i]);
    first.ts.push(this.index.ts[i]);
    first.heights.push(this.index.heights[i]);
  }

  return {
    hashes: first.hashes.concat(last.hashes),
    ts: first.ts.concat(last.ts),
    heights: first.heights.concat(last.heights)
  };
};

Chain.prototype.fromJSON = function fromJSON(json) {
  this.index.hashes = json.hashes.slice();
  this.index.ts = json.ts.slice();
  this.index.heights = json.heights.slice();

  if (this.index.hashes.length === 0) {
    var genesisBlock = BlockHeader.fromJSON(constants.GENESIS_BLOCK);
    this.blocks.list.push(genesisBlock);
    this.blocks.last = genesisBlock;
    this.index.hashes.push(genesisBlock.id);
    this.index.ts.push(genesisBlock.time);
    this.index.heights.push(0);
  }
};


Chain.Events = [ 'load' ];


module.exports = Chain;
