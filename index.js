'use strict';
var fs = require('fs');
var path = require('path');

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
      pattern = '{' + path.join(url, 'index') + ',' + (url.charAt(url.length - 1) === '/' ? url.substr(0, url.length - 1) : url) + '}.html*';
    } else if (url.indexOf('.html') >= 0) {
      pattern = url + '*';
    } else {
      return null;
    }
    var files = glob.sync(pattern, {
      cwd: path.resolve(this.options.srcDir),
      nodir: true
    });
    return files.length ? files[0] : null;
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
    var base = path.extname(relativePath) === '.html' ? relativePath : relativePath.substr(0, relativePath.length - path.extname(relativePath).length);
    base = base.replace(/index.html$/, '').replace(/.html$/, '/');
    var meta = match ? YAML.parse(match[4].trim()) : {};
    return {
      filePath: path.resolve(refrain.options.srcDir, relativePath),
      page: fast.assign({
        path: base.indexOf('/') === 0 ? base : '/' + base,
        filePath: path.join(srcDir, src)
      }, context.page, {
        layout: meta.layout === undefined ? refrain.options.layout : meta.layout,
        meta: fast.assign(meta, context.page.meta),
        template: match ? str.substring(match[0].length).trim() : str,
        body: function () {
          return refrain.pipeline(context);
        }
      }),
      data: function (name) {
        return refrain.data(name);
      },
      pages: function () {
        return refrain.pages();
      }
    };
  },

  render: function (src, context) {
    var content = this.load(src, context);
    if (!content) {
      return;
    }

    if (!content.page.layout) {
      return this.pipeline(content);
    }

    var isRelative = content.page.layout.indexOf('.') === 0;
    var layoutPath = path.join(
      isRelative ? path.dirname(content.filePath) : this.options.layoutDir,
      content.page.layout + '.*');
    var files = glob.sync(layoutPath, {
      cwd: this.options.srcDir
    });
    if (files) {
      layoutPath = files[0];
    }
    return layoutPath === src ? this.pipeline(content) : this.render(layoutPath, content);
  },

  pipeline: function (content) {
    var text = content.page.template;
    var ext = path.extname(content.filePath).substr(1);
    var tasks = this.options.pipeline[ext] || ['refrain-' + ext];
    for (var i = 0; i < tasks.length; i++) {
      var module = require(path.resolve('node_modules/' + tasks[i]));
      if (module) {
        text = module(text, content);
      }
    }
    return text;
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
