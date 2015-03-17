'use strict';
var fs = require('fs');
var path = require('path');

var async = require('async');
var fast = require('fast.js');
var glob = require('glob');
var YAML = require('yamljs');

var FRONT_MATTER_REGEX = /^\s*(([^\s\d\w])\2{2,})(?:\x20*([a-z]+))?([\s\S]*?)\1/;


class Refrain {

  constructor(options) {
    this.options = fast.assign({
      srcDir: 'src',
      dataDir: 'data',
      buildDir: 'build',
      layoutDir: 'layouts',
      layout: 'default',
      pipeline: {}
    }, options);
  }


  find(url) {
    url = url.substr(1);
    var pattern;
    if (path.extname(url) === '') {
      pattern = '{' + path.join(url, 'index') + ',' + (url.charAt(url.length - 1) === '/' ?
        url.substr(0, url.length - 1) : url) + '}.html*';
    } else {
      pattern = url + '*';
    }
    var files = glob.sync(pattern, {
      cwd: path.resolve(this.options.srcDir),
      nodir: true
    });
    if (files.length) {
      var file = files[0];
      var ext = path.extname(file).substr(1);
      return this.options.pipeline[ext] || ext === 'html' ? file : null;
    }
    return null;
  }


  defineGetter(content) {
    return Object.defineProperties(content, {
      data: {
        get: () => {
          var def = {};
          glob.sync('*.{yml,yaml,json}', {
            cwd: path.resolve(this.options.dataDir),
            nodir: true
          }).forEach(file => {
            var name = path.basename(file, path.extname(file));
            Object.defineProperty(def, name, {
              get: () => this.data(name)
            });
          });
          return def;
        }
      },
      pages: {
        get: () => this.pages()
      }
    });
  }


  load(src, context) {
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
    var base = path.extname(relativePath) === '.html' ?
      relativePath : relativePath.substr(0, relativePath.length - path.extname(relativePath).length);
    base = base.replace(/index.html$/, '').replace(/\\/, '/');
    var meta = match ? YAML.parse(match[4].trim()) || {} : null;

    var layout = null;
    if (meta) {
      if (meta.layout === undefined && context.page.layout !== refrain.options.layout) {
        layout = refrain.options.layout;
      } else {
        layout = meta.layout;
      }
    }

    var content = {
      filePath: path.resolve(refrain.options.srcDir, relativePath).replace(/\\/, '/'),
      page: fast.assign({
        path: base.indexOf('/') === 0 ? base : '/' + base,
        filePath: path.join(srcDir, src)
      }, context.page, {
        layout: layout,
        data: fast.assign(meta || {}, context.page.data || {}),
        template: match ? str.substring(match[0].length).trim() : str
      }),
      render: next => {
        refrain.pipeline(content, (err, output) => {
          content.page.body = output;
          next(err);
        });
      }
    };
    return this.defineGetter(content);
  }


  render(src, context, next) {
    src = src.replace(/\\/, '/');
    var content = this.load(src, context);
    if (!content) {
      next();
      return;
    }

    content.render(err => {
      if (err) return next(err);

      if (!content.page.layout) {
        next(null, content.page.body);
        return;
      }

      var isRelative = content.page.layout.indexOf('.') === 0;
      var layoutPath = path.join(
        path.relative(this.options.srcDir, isRelative ? path.dirname(content.filePath) : this.options.layoutDir),
        content.page.layout + '.*').replace(/\\/, '/');
      var files = glob.sync(layoutPath, {
        cwd: this.options.srcDir
      });
      if (files.length) {
        layoutPath = files[0];
        if (layoutPath !== src) {
          return this.render(layoutPath, content, next);
        }
      }
      this.pipeline(content, next);
    });
  }


  pipeline(content, next) {
    var ext = path.extname(content.filePath).substr(1);
    var tasks = this.options.pipeline[ext];
    if (tasks) {
      async.reduce(tasks, content.page.template, (text, task, next) => {
        var modulePath = path.resolve('node_modules/refrain-' + task);
        if (!fs.existsSync(modulePath)) {
          next(null, text);
          return;
        }
        var module = require(modulePath);
        if (module) {
          module.call(this, text, content, next);
        } else {
          next(null, text);
        }
      }, next);
    } else {
      next(null, content.page.template);
    }
  }


  pages() {
    return glob.sync('**/*.html*', {
      cwd: path.resolve(this.options.srcDir),
      nodir: true
    }).map(file => this.load(file).page);
  }


  data(name) {
    var srcDir = path.resolve(this.options.dataDir);
    return glob.sync(name + '.*', {
      cwd: srcDir,
      nodir: true
    }).reduce((data, file) => {
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
}


module.exports = options => new Refrain(options);
