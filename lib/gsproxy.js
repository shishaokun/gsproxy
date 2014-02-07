/*
 * gsproxy
 * https://github.com/renrenfed/gsproxy
 *
 * Copyright (c) 2014 viclm
 * Licensed under the MIT license.
 */


// The module to be exported.
var gsproxy = module.exports = {};

// Expose internal gsproxy libs.
function gRequire(name) {
  return gsproxy[name] = require('./gsproxy/' + name);
}

// Expose specific gsproxy lib methods on gsproxy.
function gExpose(obj, methodName) {
  gsproxy[methodName] = obj[methodName].bind(obj);
}

gRequire('client');
gRequire('info');
gRequire('cli');

gExpose(gsproxy.client, 'start');

try {
    gRequire('server');
    gExpose(gsproxy.server, 'sync');
    gExpose(gsproxy.server, 'syncOne');
}
catch (e) {}

gsproxy.serverdata = function () {
    var fs = require('fs');
    var maps = require('./gsproxy/maps');
    var rc = require('rc')('gsproxy'), timer;
    var home = process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];

    process.stdout.write('Update data for server.');

    require('async').series([
        function (callback) {
            timer = setInterval(function () {
                process.stdout.write('.');
            }, 500);
            callback();
        },
        function (callback) {
            fs.mkdir(home + '/.gsproxy', function () {
                callback();
            });
        },
        function (callback) {
            if (!fs.existsSync(home + '/.gsproxy/revs.json')) {
                fs.writeFileSync(home + '/.gsproxy/revs.json', '{}');
            }
            callback();
        },
        function (callback) {
            if (!fs.existsSync(home + '/.gsproxy/members.json')) {
                fs.writeFileSync(home + '/.gsproxy/members.json', '{}');
            }
            callback();
        },
        function (callback) {
            maps.collectGitReposBare(rc.root.git, function (err, result) {
                fs.writeFileSync(home + '/.gsproxy/gitmaps.json', JSON.stringify(result));
                callback();
            });
        },
        function (callback) {
            maps.collectSVNMapping(rc.root.svn, function (err, result) {
                fs.writeFileSync(home + '/.gsproxy/svnmaps.json', JSON.stringify(result));
                callback();
            });
        }
    ],
    function () {
        clearInterval(timer);
        console.log(' done.');
    });
};
