/*
 * gsproxy
 * https://github.com/renrenfed/gsproxy
 *
 * Copyright (c) 2014 viclm
 * Licensed under the MIT license.
 */

'use strict';

var async = require('async');
var child_process = require('child_process');
var colors = require('colors');
var fs = require('fs');
var nodegit = require('nodegit');
var path = require('path');
var rc = require('rc');
var xml2js = require('xml2js');

var home = process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
var $members = JSON.parse(fs.readFileSync(path.join(home, '.gsproxy/members.json')));
var $gitmaps = JSON.parse(fs.readFileSync(path.join(home, '.gsproxy/gitmaps.json')));
var $svnmaps = JSON.parse(fs.readFileSync(path.join(home, '.gsproxy/svnmaps.json')));
var $configs = rc('gsproxy');

var compile = require('./compile').init($gitmaps, $configs.root.git, true);

var copyToSVN = function (filepath, file) {
    if (fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, file);
    }
    else {
        var filepathArray = [];
        while (!fs.existsSync(filepath)) {
            filepath = filepath.replace(/\/[^\/]+$/, function (str) {
                filepathArray.unshift(str);
                return '';
            });
        }
        filepathArray.slice(0, -1).forEach(function (d) {
            filepath = path.join(filepath, d);
            fs.mkdirSync(filepath);
        });
        fs.writeFileSync(path.join(filepath, filepathArray.pop()), file);
    }
};

var parseConfig = function (repo, callback) {
    var configs = {};
    async.waterfall([
        function (callback) {
            nodegit.Repo.open(repo, function (error, repo) {
                configs.repo = repo;
                repo.getBranch('master', function(error, commit) {
                    configs.head = commit;
                    callback();
                });
            });
        },
        function (callback) {
            configs.head.getEntry('template-config.xml', function(err, entry) {
                entry.getBlob(function(err, blob) {
                    configs.rid = blob.toString().match(/url="([^"]+)"/)[1];
                    var parser = new xml2js.Parser({async: false});
                    parser.parseString(blob.toString(), function (err, result) {
                        result = result.package;
                        configs.source = result.source && result.source[0].combine || [];
                        configs.library = result.library && result.library[0].folder || [];
                        callback();
                    });
                });
            });
        },
        function (callback) {
            var files = [];
            var readTree = function (t, callback) {
                t.getTree(function (err, tree) {
                    async.each(tree.entries(), function (te, cb) {
                        if (te.isTree()) {
                            readTree(te, cb);
                        }
                        else {
                            if (/\.css$/.test(te.name())) {
                                files.push(te.path());
                            }
                            cb();
                        }
                    }, callback);
                });
            };
            configs.head.getTree(function (err, tree) {
                tree.entries().some(function (te) {
                    if (te.name() === 'src') {
                        readTree(te, function (err) {
                            callback(null, files);
                        });
                        return true;
                    }
                    else {
                        return false;
                    }
                });
            });
        },
        function (cssfiles, callback) {
            var css = {};
            async.each(cssfiles, function (cssfile, cb) {
                configs.head.getEntry(cssfile, function(err, entry) {
                    entry.getBlob(function(err, blob) {
                        blob.toString().replace(/^@import\surl\(["']?([^"'\(\)]+)["']?\);/mg, function (s, p) {
                            css[cssfile] = css[cssfile] || [];
                            css[cssfile].push(path.join(path.dirname(cssfile), p));;
                        });
                        cb();
                    });
                });
            }, function (err) {
                configs.css = css;
                callback();
            });
        }
    ], function (err) {
        callback(configs);
    });
};

exports.syncOne = function (rev, options) {
    var configs, commitInfo = {}, jsfiles = [], cssfiles = [], diffs = {};
    async.waterfall([
        function (callback) {
            parseConfig(options.repo, function (c) {
                configs = c;
                callback();
            });
        },
        function (callback) {
            configs.repo.getCommit(rev, function (err, commit) {
                commitInfo.author = commit.author().toString().match(/^\S+/)[0];
                commitInfo.message = commit.message().trim();
                commit.getDiff(function (err, diffList) {
                    diffList.forEach(function (diff) {
                        diff.patches().forEach(function (cp) {
                            // 1:add 2:delete 3:modify
                            diffs[cp.newFile().path()] = cp.status();
                        });
                    });
                    callback();
                });
            });
        },
        function (callback) {
            // git diff-tree --no-commit-id --name-only -r
            Object.keys(diffs).forEach(function (filename) {
                if (/\.css$/.test(filename)) {
                    cssfiles[filename] = true;
                }
                else if (/\.js$/.test(filename)) {
                    jsfiles[filename] = true;
                }
            });

            Object.keys(jsfiles).forEach(function (filename) {
                if (configs.source.some(function (combine) {
                    return combine.include.some(function (include) {
                        var target;
                        include = include.$;
                        if (include.path) {
                            target = path.join('src', include.path);
                        }
                        else if (include.module) {
                            target = path.join('src/node_modules', include.module);
                        }

                        if (target === filename) {
                            delete jsfiles[filename];
                            jsfiles['src/' + combine.$.path] = combine.include;
                            return true;
                        }
                        else {
                            return false;
                        }
                    });
                })) {}
                else if (filename.indexOf('src/') === 0) {
                    jsfiles[filename] = false;
                }
                else {
                    delete jsfiles[filename];
                }
            });

            Object.keys(cssfiles).forEach(function (filename) {
                if (configs.css[filename]) {}
                else if (Object.keys(configs.css).some(function (f1) {
                    return configs.css[f1].some(function (f2) {
                        if (f2 === filename) {
                            cssfiles[f1] = true;
                            delete cssfiles[f2];
                            return true;
                        }
                        else {
                            return false;
                        }
                    })
                })) {
                    delete cssfiles[filename];
                }
            });

            jsfiles = Object.keys(jsfiles);
            cssfiles = Object.keys(cssfiles);
            callback(jsfiles.length + cssfiles.length > 0 ? null : '0:No files need to be transported.');
        },
        function (callback) {
            if (fs.existsSync($svnmaps[configs.rid])) {
                child_process.exec('svn update ' + $svnmaps[configs.rid], function (err, stdout, stderr) {
                    if (/At\srevision\s\d+\.\s$/.test(stdout)) {
                        callback();
                    }
                    else {
                        console.log(stdout);
                        callback(err || stdout);
                    }
                });
            }
            else {
                callback('no svn directory matched:' + $svnmaps[configs.rid]);
            }
        },
        function (callback) {
            async.parallel([
                function (c) {
                    async.each(jsfiles, function (filename, cb) {
                        if (diffs[filename] === 2) {return cb();}
                        console.log('  Compile ' + filename + '.');
                        compile.js(options.repo, filename.slice(4), function (err, result) {
                            if (!err) {
                                copyToSVN(path.join($svnmaps[configs.rid], filename.slice(4)), result.data);
                            }
                            cb();
                        });
                    }, c);
                },
                function (c) {
                    async.each(cssfiles, function (filename, cb) {
                        if (diffs[filename] === 2) {return cb();}
                        console.log('  Compile ' + filename + '.');
                        compile.css(options.repo, filename.slice(4), function (err, result) {
                            if (!err) {
                                copyToSVN(path.join($svnmaps[configs.rid], filename.slice(4)).replace(/(\.css)$/, '-all-min$1'), result.data);
                            }
                            cb();
                        });
                    }, c);
                }
            ], function () {
                callback();
            });
        },
        function (callback) {
            child_process.exec('svn status ' + $svnmaps[configs.rid], function (err, stdout) {
                console.log(stdout);
                callback(err, stdout);
            });
        },
        function (svnst, callback) {
            var auth = '--username "'+commitInfo.author+'" --password "'+$members[commitInfo.author]+'"';
            async.each(svnst.match(/[?!]\s+\S+/mg) || [], function (entry, c) {
                var st = entry.slice(0, 1);
                var filename = entry.slice(1).trim();
                if (st === '?') {
                    child_process.exec('svn add ' + filename + ' ' + auth, function (err, stdout) {
                        if (/^A/.test(stdout)) {
                            c();
                        }
                        else {
                            c(err || stdout);
                        }
                    });
                }
                else if (st === '!') {
                    child_process.exec('svn rm ' + filename + ' ' + auth, function (err, stdout) {
                        if (/^D/.test(stdout)) {
                            c();
                        }
                        else {
                            c(err || stdout);
                        }
                    });
                }
            }, function (err) {
                if (err) {
                    callback(err);
                }
                else {
                    child_process.exec('svn commit ' + $svnmaps[configs.rid] + ' -m "' + commitInfo.message + '" ' + auth, function (err, stdout) {
                        console.log(stdout);
                        if (/Committed\srevision\s\d+\.\s$/.test(stdout)) {
                            callback();
                        }
                        else {
                            callback(err || stdout);
                        }
                    });
                }
            });
        }
    ],
    function (err) {
        if (err) {
            if (err.toString().indexOf('0:') === 0) {
                err = err.slice(2);
                console.log(err.yellow);
            }
            else {
                console.log(err.red);
                var revs = JSON.parse(fs.writeFileSync(path.join(home, '.gsproxy/revs.json')));
                revs[rev] = options.repo;
                fs.writeFileSync(JSON.stringify(path.join(home, '.gsproxy/revs.json')));
            }
        }
        else {
            console.log('Transport successfully.'.green);
        }
    });

};

exports.sync = function (options) {
    child_process.exec('git rev-list ' + options.newrev + '...' + options.oldrev + ' --reverse', function (err, stdout) {
        stdout.match(/\S+/mg).forEach(function (rev) {
            exports.syncOne(rev, options);
        });
    });
};
