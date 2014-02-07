var async = require('async');
var colors = require('colors');
var fs = require('fs');
var glob = require('glob');
var path = require('../util/path.js');
var xml2js = require('xml2js');
var nodegit;

exports.init = function (maps, base, fromGit) {

    var exports = {};

    var repos = {};

    // @pathname is based on repo
    var readFile = function (repo, pathname, callback) {
        var filepath = path.join(repo, pathname);
        if (fromGit) {
            var readFileFromGit = function (commit) {
                commit.getEntry(pathname, function(err, entry) {
                    if (err || !entry.isFile()) {
                        console.log(('NULL: ' + path.relative(base, filepath)).red);
                        callback(null, {data: '/* Error: ' + filepath + ' */\n', err: err});
                    }
                    else {
                        entry.getBlob(function(err, blob) {
                            var data = blob.toString();
                            if (/\.(?:js)|(?:css)$/.test(pathname)) {
                                data = '/* From: ' + filepath + ' */\n' + data;
                            }
                            callback(null, {data: data, err: null});
                        });
                    }
                });
            };
            if (!nodegit) {nodegit = require('nodegit');}
            if (repos[repo]) {
                readFileFromGit(repos[repo]);
            }
            else {
                nodegit.Repo.open(repo, function (error, repo) {
                    repo.getBranch('master', function(error, commit) {
                        repos[repo] = commit;
                        readFileFromGit(commit);
                    });
                });
            }
        }
        else {
            fs.readFile(filepath, {encoding: 'utf8'}, function (err, data) {
                if (err) {
                    console.log(('NULL: ' + path.relative(base, filepath)).red);
                    data = '/* Error: ' + filepath + ' */\n';
                }
                else if (/\.(?:js)|(?:css)$/.test(pathname)) {
                    data = '/* From: ' + filepath + ' */\n' + data + '\n';
                }
                callback(null, {data: data, err: err});
            });
        }
    };

    // @pathname is based on repo/src
    var concatjs = function (configs, repo, pathname, callback) {

        async.mapSeries(configs.source[pathname], function (filepath, c) {
            if (filepath.$.module) {
                filepath = filepath.$.module;
                readFile(repo, path.join('src/node_modules', filepath), function (err, result) {
                    if (!result.err && /\.mustache$/.test(filepath)) {
                        result.data = result.data.replace(/^(.+?\n)(.*)$/, function (str, p1, p2) {
                            return p1 +
                                    ";object.define('xn/" +
                                    repo.match(/[^\/]+\/$/)[0] +
                                    filepath +
                                    "', function(require, exports, module) {return '" +
                                    p2.replace(/[\r\n]/g, '') +
                                    "';});";
                        });
                    }
                    c(null, result);
                });
            }
            else {
                filepath = filepath.$.path;
                var hasLib = filepath.match(/^\.\.\/lib\/([^\/]+)\/(.+)$/);
                if (hasLib) {
                    var map = configs.library[hasLib[1]];
                    if (map && maps[map]) {
                        filepath = hasLib[2].replace(/^(src\/)?/, function (str, p) {return p ? '' : '../'; });
                        exports.js(maps[map], filepath, c);
                    }
                    else {
                        readFile(repo, path.join('src', filepath), c);
                    }
                }
                else if (configs.source[filepath]) {
                    concatjs(configs, repo, filepath, c);
                }
                else if (filepath.indexOf('*') > -1) {
                    glob(path.join(repo, 'src', filepath), function (err, files) {
                        async.mapSeries(files, function (f, cb) {
                            readFile(repo, path.relative(repo, f), cb);
                        }, function (err, result) {
                            c(null, {
                                data: result.map(function (item) {return item.data}).join('\n'),
                                err: null
                            });
                        });
                    });
                }
                else {
                    readFile(repo, path.join('src', filepath), c);
                }
            }
        }, function (err, result) {
            callback(null, {
                data: result.map(function (item) {return item.data}).join('\n'),
                err: result.map(function (item) {return item.err}).filter(function (item) {return item})
            });
        });

    };

    // @pathname is based on repo/src
    exports.js = function (repo, pathname, callback) {
        readFile(repo, 'template-config.xml', function (err, data) {
            var parser = new xml2js.Parser({async: false});
            parser.parseString(data.data, function (err, result) {
                var configs = {source: {}, library: {}};
                if (result.package.library && result.package.library[0].folder) {
                    result.package.library[0].folder.forEach(function (folder) {
                        configs.library[folder.$.name] = folder.$.url;
                    });
                }
                if (result.package.source && result.package.source[0].combine) {
                    result.package.source[0].combine.forEach(function (combine) {
                        if (!combine.include) {
                            combine.include = [combine];
                        }
                        configs.source[combine.$.path] = combine.include;
                    });
                }

                if (configs.source[pathname]) {
                    concatjs(configs, repo, pathname, callback);
                }
                else {
                    readFile(repo, path.join('src', pathname), function (err, result) {
                        callback(result.err, result);
                    });
                }
            });
        });
    };

    exports.css = function (repo, pathname, callback, stack) {
        if (stack === undefined) {
            stack = [];
        }
        if (stack.indexOf(path.relative(base, path.join(repo, pathname))) > -1) {
            console.log(('DUPLICATE: ' + path.relative(base, path.join(repo, pathname))).yellow);
            callback(null, {data: '/* Duplicate: ' + path.join(repo, pathname) + ' */\n', err: 'Duplicate reference'});
            return;
        }
        stack.push(path.relative(base, path.join(repo, pathname)));
        readFile(repo, path.join('src', pathname), function (err, result) {
            if (result.err) {
                callback(result.err, result);
            }
            else {
                var tasks = [function (cb) {cb(null, '')}];
                var results = [];
                var rRemote = /^@import\surl\(["']?([^"'\(\)]+)["']?\);$/mg;
                var lastIndex = 0;
                var res;
                while (res = rRemote.exec(result.data)) {
                    results.push({result: res, lastIndex: rRemote.lastIndex});
                }
                results.forEach(function (res) {
                    var substr = result.data.slice(lastIndex, res.lastIndex - res.result[0].length);
                    lastIndex = res.lastIndex;
                    tasks.push(function (str, cb) {
                        cb(null, str + substr);
                    });
                    tasks.push(function (str, cb) {
                        var subpathname = path.join('src', path.dirname(pathname), res.result[1]);
                        var hasLib = subpathname.match(/^lib\/([^\/]+)\/(.+)$/);
                        if (hasLib) {
                            readFile(repo, 'template-config.xml', function (err, result) {
                                var parser = new xml2js.Parser({async: false});
                                parser.parseString(result.data, function (err, result) {
                                    var map = result.package.library && result.package.library[0].folder || [];
                                    map = map.filter(function (folder) {return folder.$.name === hasLib[1];});
                                    map = map[0] ? map[0].$.url : undefined;
                                    map = maps[map];
                                    if (map) {
                                        var filepath = hasLib[2].replace(/^(src\/)?/, function (str, p) {
                                            return p ? '' : '../';
                                        });
                                        exports.css(map, filepath, function (err, data) {
                                            cb(null, str + data.data);
                                        }, stack);
                                    }
                                    else {
                                        exports.css(repo, path.join(path.dirname(pathname), res.result[1]), function (err, data) {
                                            cb(null, str + data.data);
                                        }, stack);
                                    }
                                });
                            });
                        }
                        else {
                            exports.css(repo, path.join(path.dirname(pathname), res.result[1]), function (err, data) {
                                cb(null, str + data.data);
                            }, stack);
                        }
                    });
                });
                tasks.push(function (str, cb) {
                    cb(null, str + result.data.slice(lastIndex));
                });
                async.waterfall(tasks, function (err, data) {callback(null, {data: data, err: null})});
            }
        });
    };

    return exports;

};
