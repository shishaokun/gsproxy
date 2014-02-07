'use strict';

var gsproxy = require('../lib/gsproxy');

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports.gsproxyserver = {
  setUp: function(done) {
    // setup here
    done();
  },
  'syncOne': function(test) {
    test.done();
  }
};
gsproxy.syncOne('4179113a1055227a37c968b1612373be4c6ed835', {repo: '/Users/viclm/Code/git/gitcore.git'});
