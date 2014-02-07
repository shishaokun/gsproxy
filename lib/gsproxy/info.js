'use strict';

// Project metadata.
var pkg = require('../../package.json');

// Display version.
exports.version = function() {
    console.log('gsproxy v' + pkg.version);
};

// Show help, then exit with a message and error code.
exports.fatal = function(msg, code) {
    exports.helpHeader();
    console.log('Fatal error: ' + msg);
    console.log('');
    exports.helpFooter();
    process.exit(code);
};

// Show help and exit.
exports.help = function() {
    exports.helpHeader();
    exports.helpFooter();
    process.exit();
};

// Help header.
exports.helpHeader = function() {
    var optlist = require('./cli').optlist;
    var options = Object.keys(optlist).map(function (optionName) {
        var option = optlist[optionName];
        return '  --' + optionName + (option.short ? '('+option.short+')' : '') + ': ' + option.info;
    });
    [
        '\ngsproxy: ' + pkg.description,
        '\nUsage: gsproxy <command>',
        '\nCommands:',
        '  gsproxy start: Start a local Git/SVN proxy server.',
        '\nOptions:',
    ].concat(options).forEach(function(str) { console.log(str); });
};

// Help footer.
exports.helpFooter = function() {
    [
        '\n'
    ].forEach(function(str) { console.log(str); });
};
