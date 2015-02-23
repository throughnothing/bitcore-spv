# bitcore-spv

[![Build Status](https://travis-ci.org/throughnothing/bitcore-spv.svg?branch=master)](https://travis-ci.org/throughnothing/bitcore-spv)
[![Coverage Status](https://coveralls.io/repos/throughnothing/bitcore-spv/badge.svg?branch=master)](https://coveralls.io/r/throughnothing/bitcore-spv?branch=master)

Bitcore-spv aims to be bitcoin SPV client (currently with a Wallet)
written entirely in Javascript, and based on
[bitcore](https://github.com/bitpay/bitcore).

Currently this will not run in browsers as-is, but the
[chrome-net](https://github.com/feross/chrome-net) project can be used
to replace node's `net` module when building for the browser.  My
[BitcoinSPVCrx](https://github.com/throughnothing/BitcoinSPVCrx) project
currently does this to make `bitcore-spv` run in a Chrome App.  A similar
approach should definitely be possible to utilize WebRTC or whatever
sockets implementation Firefox provides.


## Development requirements

  * Node.js + [npm](https://www.npmjs.org/).
  * `npm install`

## Running the sample script

  * `node scripts/spvnode.js`

This is an example script provided for testing.  It will currently sync
with the blockchain, and update the `lib/data/index.js` data file, which
stores a compressed/shrunk version of verified block headers.
