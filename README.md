# gsproxy
[![Build Status](https://secure.travis-ci.org/renrenfed/gsproxy.png?branch=master)](http://travis-ci.org/renrenfed/gsproxy)
[![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/)

A proxy server for sync Git repos to SVN repo.

## Getting Started
1. Install the module with: `npm install gsproxy`
2. Run `gsproxy start` to start a Git/SVN proxy server
3. Config nginx and start
```text
server {
    listen       80;
    server_name  customdomain.com;
    charset utf-8;
    root    path/to/localsvnrepo;
    autoindex       on;
    autoindex_exact_size    on;

    rewrite ^/a?([0-9])+/(.*)$ /$2 last;
    rewrite (.*)\.[0-9]+\.css /$1.css;
    rewrite (.*)\.[0-9]+\.js /$1.js;

    location / {
        index   index.html index.htm;
    }
    location ~* /.+\.(css|js)$ {
        proxy_set_header x-request-filename $request_filename;
        proxy_pass http://127.0.0.1:7070;
    }
}
```   
4. Run with --help or -h for options.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2014 viclm
Licensed under the MIT license.
