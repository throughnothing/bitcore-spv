'use strict';

module.exports = {
  MAX_GETDATA_HASHES: 50000,
  MAINNET_CHECKPOINTS: require('./mainnet_checkpoints'),
  TESTNET_CHECKPOINTS: require('./testnet_checkpoints'),
  GENESIS_BLOCK: {
    height: 0, // Extra
    version: 1,
    time: 1231006505,
    bits: 486604799,
    nonce: 2083236893,
    hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', // Extra
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    merkleRoot: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
  }
};
