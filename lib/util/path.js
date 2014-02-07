var path = require('path');

Object.keys(path).forEach(function (key) {
    exports[key] = function () {
        return path[key].apply(path, arguments);
    }
});

exports.normalize = function (p) {
    return path.normalize(p).split(path.sep).join('/');
};
exports.join = function (p/*, p2, p3 ...*/) {
    return path.join.apply(path, arguments).split(path.sep).join('/');
};
