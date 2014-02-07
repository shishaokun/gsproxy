'use strict';

var async = require('async');
var fs = require('fs');
var glob = require('glob');
var path = require('../util/path.js');
var nodegit;

exports.collectGitRepos = function (dirname, callback) {
    glob('**/template-config.xml', {cwd: dirname}, function (err, result) {
        var repos = {};
        async.each(result, function (filepath, c) {
            fs.readFile(path.join(dirname, filepath), {encoding: 'utf8'}, function (err, data) {
                data = data.match(/url="([^"]+)"/);
                if (data) {
                    repos[data[1]] = path.dirname(path.join(dirname, filepath));
                }
                c();
            });
        }, function (err) {
            console.log(repos);
            callback(null, repos);
        });
    });
};

exports.collectGitReposBare = function (dirname, callback) {
    glob('*.git', {cwd: dirname}, function (err, result) {
        var repos = {};
        async.each(result, function (filepath, c) {
            if (!nodegit) {nodegit = require('nodegit');}
            nodegit.Repo.open(path.join(dirname, filepath), function (error, repo) {
                repo.getBranch('master', function(error, commit) {
                    commit.getEntry('template-config.xml', function(err, entry) {
                        if (entry) {
                            entry.getBlob(function(err, blob) {
                                var data = blob.toString();
                                data = data.match(/url="([^"]+)"/);
                                if (data) {
                                    repos[data[1]] = path.join(dirname, filepath);
                                }
                                c();
                            });
                        }
                        else {
                            c();
                        }
                    });
                });
            });
        }, function (err) {
            callback(null, repos);
        });
    });
};


exports.collectSVNMapping = function (dirname, callback) {
    glob('**/.package', {cwd: dirname}, function (err, result) {
        var repos = {};
        async.each(result, function (filepath, c) {
            fs.readFile(path.join(dirname, filepath), {encoding: 'utf8'}, function (err, data) {
                data = data.trim();
                if (data) {
                    repos[data] = path.dirname(path.join(dirname, filepath));
                }
                c();
            });
        }, function (err) {
            callback(null, repos);
        });
    });
};
