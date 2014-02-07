'use strict';

var async = require('async');
var colors = require('colors');
var fs = require('fs');
var http = require('http');
var path = require('../util/path.js');
var url = require('url');
var compile;
var $maps;

var findPackage = function (path) {
    var filename;
    path = path.replace(/[^\/]+$/, '');
    while (path !== '/') {
        if (fs.existsSync(path)) {
            filename = fs.readdirSync(path);
            filename = filename.filter(function (f) {return f === '.package'});
            if (filename.length) {
                return {
                    package: fs.readFileSync(path + filename[0], {encoding: 'utf8'}),
                    packagePath: path
                };
            }
        }
        path = path.replace(/[^\/]+\/$/, '');
    }
};

var onRequest = function (request, response) {

    var pathname = path.normalize(url.parse(request.url).pathname);
    var svnfilepath = path.normalize(request.headers['x-request-filename']);
    var fileType = /\.js$/.test(pathname) ? 'javascript' : 'css';
    var repo = findPackage(svnfilepath);
    var reg = /\//g, subpathname;
    var readFileSVN = function (type) {
        if (fs.existsSync(svnfilepath)) {
            console.log(('SVN: ' + pathname));
            output(response, fs.readFileSync(svnfilepath, {encoding: 'utf8'}), type);
        }
        else {
            console.log(('404: ' + pathname).grey);
            output(response, '404 Not Found', 'plain');
        }
    };

    if (repo && $maps[repo.package]) {

        while (reg.test(repo.packagePath)) {
            if (pathname.indexOf(repo.packagePath.slice(reg.lastIndex - 1)) === 0) {
                subpathname = pathname.slice(repo.packagePath.length - reg.lastIndex + 1);
                break;
            }
        }

        if (fileType === 'javascript') {
            compile.js($maps[repo.package], subpathname, function (err, result) {
                if (err) {
                    readFileSVN('javascript');
                }
                else {
                    console.log(('HG: ' + pathname));
                    output(response, result.data, 'javascript');
                }
            });
        }
        else if (fileType === 'css') {
            compile.css($maps[repo.package], subpathname.replace(/-all-min(\.css)$/, '$1'), function (err, result) {
                if (err) {
                    readFileSVN('css');
                }
                else {
                    console.log(('HG: ' + pathname));
                    output(response, result.data, 'css');
                }
            });
        }
    }
    else {
        readFileSVN('css');
    }
};

var output = function (response, data, type) {
    response.writeHeader(type === 'plain' ? 404 : 200, {'content-type': 'text/' + type});
    response.end(data);
};

exports.start = function (options) {

    var timer;

    options = options || {};
    options.base = options.base || './';
    options.port = options.port || '7070';

    process.stdout.write('Starting server.');

    async.series([
        function (callback) {
            timer = setInterval(function () {
                process.stdout.write('.');
            }, 500);
            callback();
        },
        function (callback) {
            require('./maps.js').collectGitRepos(options.base, function (err, maps) {
                compile = require('./compile.js').init(maps, options.base);
                $maps = maps;
                callback();
            });
        },
        function (callback) {
            http.createServer()
            .listen(options.port)
            .on('request', onRequest)
            .on('listening', callback);
        }
    ],
    function () {
        clearInterval(timer);
        console.log(' done, waiting...');
    });

};
