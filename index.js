var utils = require('loader-utils');
var sass = require('node-sass');
var path = require('path');
var sassGraph = require('sass-graph');
var spawn = require('win-spawn');

module.exports = function (content) {
    this.cacheable();
    var callback = this.async();

    var opt = utils.parseQuery(this.query);

    // skip empty files, otherwise it will stop webpack, see issue #21
    if (content.trim() === '') {
        return callback(null, content);
    }

    // set include path to fix imports
    opt.includePaths = opt.includePaths || [];
    opt.includePaths.push(path.dirname(this.resourcePath));
    if (this.options.resolve && this.options.resolve.root) {
        var root = [].concat(this.options.resolve.root);
        opt.includePaths = opt.includePaths.concat(root);
    }

    // output compressed by default
    opt.outputStyle = opt.outputStyle || 'compressed';
    
    var loadPaths = opt.includePaths;
    var markDependencies = function () {
        try {
            var graph = sassGraph.parseFile(this.resourcePath, {loadPaths: loadPaths});
            graph.visitDescendents(this.resourcePath, function (imp) {
                this.addDependency(imp);
            }.bind(this));
        } catch (err) {
            this.emitError(err);
        } 
    }.bind(this);

    var sass_bin = 'sass';
    var sass_args = ['--stdin', '--no-cache', '--scss'];

    loadPaths.forEach(function (path) {
        sass_args.push('-I');
        sass_args.push(path);
    });

    var sass_process = spawn(sass_bin, sass_args);

    var sass_out = '';
    var sass_err = '';

    sass_process.stdout.on('data', function (data) {
        sass_out += data;
    });

    sass_process.stderr.on('data', function (data) {
        sass_err += data;
    });


    sass_process.on('error', function () {
        markDependencies();
        callback({message: 'sass fail.' +' :::: '+ sass_err });
    });
    sass_process.on('close', function (code) {
        markDependencies();
        if (code > 0) {
          return callback({message: 'sass fail. ('+code+')' +' :::: '+ sass_err });
        }
        callback(null, sass_out);
    });

    sass_process.stdin.end(content);
};
