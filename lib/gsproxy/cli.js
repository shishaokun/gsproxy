'use strict';

var gsproxy = require('../gsproxy');

var nopt = require('nopt');
var path = require('path');

// This is only executed when run via command line.
var cli = module.exports = function () {
    // Run tasks.
    if (gsproxy[cli.task]) {
        gsproxy[cli.task](cli.options);
    }
    else if (cli.options.help) {
        gsproxy.info.help();
    }
    else if (cli.options.version) {
        gsproxy.info.version();
    }
    else {
        gsproxy.info.help();
    }
};

// Default options.
var optlist = cli.optlist = {
    help: {
        short: 'h',
        info: 'Display this help text.',
        type: Boolean
    },
    version: {
        short: 'v',
        info: 'Print the gsproxy version.',
        type: Boolean
    },
    base: {
        info: 'Path to workspace.',
        type: path
    },
    port: {
        short: 'p',
        info: 'The port on which the client webserver will respond.',
        type: Number
    }
};

// Parse `optlist` into a form that nopt can handle.
var aliases = {};
var known = {};

Object.keys(optlist).forEach(function(key) {
    var short = optlist[key].short;
    if (short) {
        aliases[short] = '--' + key;
    }
    known[key] = optlist[key].type;
});

var parsed = nopt(known, aliases, process.argv, 2);
cli.task = parsed.argv.remain;
cli.options = parsed;
delete parsed.argv;
if (!cli.options.base) {
    cli.options.base = process.cwd();
}
