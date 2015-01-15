'use strict';
var fs = require('fs');
var path = require('path');

var async = require('async');
var fast = require('fast.js');
var glob = require('glob');
var YAML = require('yamljs');

var FRONT_MATTER_REGEX = /^\s*(([^\s\d\w])\2{2,})(?:\x20*([a-z]+))?([\s\S]*?)\1/;

module.exports = function (options) {
  var obj = Object.create(refrain);
  obj.options = fast.assign({
    srcDir: 'src',
    dataDir: 'data',
    buildDir: 'build',
    layoutDir: 'layouts',
    layout: 'default',
    pipeline: {}
  }, options);
  return obj;
};

var refrain = {
  find: function (url) {
    url = url.substr(1);
    var pattern;
    if (path.extname(url) === '') {
      pattern = '{' + path.join(url, 'index') + ',' + (url.charAt(url.length - 1) === '/'
        ? url.substr(0, url.length - 1) : url) + '}.html*';
    } else {
      pattern = url + '*';
    }
    var files = glob.sync(pattern, {
      cwd: path.resolve(this.options.srcDir),
      nodir: true
    });
    if (files.length) {
      var file = files[0];
      return this.options.pipeline[path.extname(file).substr(1)] ? file : null;
    }
    return null;
  },

  load: function (src, context) {
    context = context || {
      page: {}
    };
    var refrain = this;
    var srcDir = path.resolve(refrain.options.srcDir);
    if (src.indexOf('/') !== 0) {
      src = path.join(refrain.options.srcDir, src);
    }
    var relativePath = path.relative(srcDir, src);
    var str = fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
    var match = FRONT_MATTER_REGEX.exec(str);
    var base = path.extname(relativePath) === '.html'
      ? relativePath
      : relativePath.substr(0, relativePath.length - path.extname(relativePath).length);
    base = base.replace(/index.html$/, '').replace(/\\/, '/');
    var meta = match ? YAML.parse(match[4].trim()) : {};
    var content = {
      filePath: path.resolve(refrain.options.srcDir, relativePath).replace(/\\/, '/'),
      page: fast.assign({
        path: base.indexOf('/') === 0 ? base : '/' + base,
        filePath: path.join(srcDir, src)
      }, context.page, {
        layout: src.indexOf('.html') >= 0
          ? meta.layout === undefined && context.page.layout !== refrain.options.layout ? refrain.options.layout : meta.layout
          : null,
        data: fast.assign(meta, context.page.data || {}),
        template: match ? str.substring(match[0].length).trim() : str
      }),
      render: function (next) {
        var self = this;
        refrain.pipeline(this, function (err, output) {
          self.page.body = output;
          next(err);
        });
      }
    };

    Object.defineProperties(content, {
      data: {
        get: function () {
          var def = {};
          glob.sync('*.{yml,yaml,json}', {
            cwd: path.resolve(refrain.options.dataDir),
            nodir: true
          }).forEach(function (file) {
            var name = path.basename(file, path.extname(file));
            Object.defineProperty(def, name, {
              get: function () {
                return refrain.data(name);
              }
            });
          });
          return def;
        }
      },
      pages: {
        get: function () {
          return refrain.pages();
        }
      }
    });

    return content;
  },

  render: function (src, context, next) {
    src = src.replace(/\\/, '/');
    var self = this;
    var content = this.load(src, context);
    if (!content) {
      next();
      return;
    }

    content.render(function (err) {
      if (err) return next(err);

      if (!content.page.layout) {
        next(null, content.page.body);
        return;
      }

      var isRelative = content.page.layout.indexOf('.') === 0;
      var layoutPath = path.join(
        path.relative(self.options.srcDir, isRelative ? path.dirname(content.filePath) : self.options.layoutDir),
        content.page.layout + '.*').replace(/\\/, '/');
      var files = glob.sync(layoutPath, {
        cwd: self.options.srcDir
      });
      if (files.length) {
        layoutPath = files[0];
        if (layoutPath !== src) {
          return self.render(layoutPath, content, next);
        }
      }
      self.pipeline(content, next);
    });
  },

  pipeline: function (content, next) {
    var refrain = this;
    var ext = path.extname(content.filePath).substr(1);
    var tasks = this.options.pipeline[ext];
    async.reduce(tasks, content.page.template, function (text, task, next) {
      var modulePath = path.resolve('node_modules/refrain-' + task);
      if (!fs.existsSync(modulePath)) {
        next(null, text);
        return;
      }
      var module = require(modulePath);
      module ? module.call(refrain, text, content, next) : next(null, text);
    }, next);
  },

  pages: function () {
    var self = this;
    return glob.sync('**/*.html*', {
      cwd: path.resolve(this.options.srcDir),
      nodir: true
    }).map(function (file) {
      return self.load(file).page;
    });
  },

  data: function (name) {
    var srcDir = path.resolve(this.options.dataDir);
    return glob.sync(name + '.*', {
      cwd: srcDir,
      nodir: true
    }).reduce(function (data, file) {
      switch (path.extname(file)) {
        case '.yml':
        case '.yaml':
          fast.assign(data, require('yamljs').parse(fs.readFileSync(path.join(srcDir, file), 'utf-8')));
          break;
        case '.json':
          fast.assign(data, JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf-8')));
          break;
      }
      return data;
    }, {});
  }
};
