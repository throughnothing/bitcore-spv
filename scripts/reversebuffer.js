'use strict';
/* Script to reverse buffers
 * Useful for testing/debugging with data from block explorers, etc., that
 * need to be reversed to use bitcoin protocol formatting.
 */
var BufferUtil = require('bitcore').util.buffer;

console.log(BufferUtil.reverse(new Buffer(process.argv[2], 'hex')).toString('hex'));
