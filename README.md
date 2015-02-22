# bitcore-spv

Bitcore-spv aims to be bitcoin SPV client (currently with a Wallet)
written entirely in Javascript, and based on
[bitcore](https://github.com/bitpay/bitcore).


## Development requirements

  * Node.js + [npm](https://www.npmjs.org/).
  * `npm install`

## Running the sample script

  * `node scripts/spvnode.js`

This is an example script provided for testing.  It will currently sync
with the blockchain, and update the `lib/data/index.js` data file, which
stores a compressed/shrunk version of verified block headers.
