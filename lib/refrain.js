'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _lodash = require('lodash');

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

var _yamljs = require('yamljs');

var _yamljs2 = _interopRequireDefault(_yamljs);

var FRONT_MATTER_REGEX = /^\s*(([^\s\d\w])\2{2,})(?:\x20*([a-z]+))?([\s\S]*?)\1/;

var Refrain = (function () {

  /**
   * @constructor
   * @param {String} [srcDir='src'] The source directory
   * @param {String} [dataDir='data'] The data directory
   * @param {String} [buildDir='build'] The build directory
   * @param {String} [layoutDir='layouts'] The layout directory
   * @param {String} [layout='default'] The default layout
   * @param {Object} [pipeline={}] The dictionary of pipeline tasks
   * @param {Object} [data={}] The additional data object, this merges into
   *                           context.page.data object before pipeline processing.
   */

  function Refrain(options) {
    _classCallCheck(this, Refrain);

    this.options = (0, _lodash.assign)({
      srcDir: 'src',
      dataDir: 'data',
      buildDir: 'build',
      layoutDir: 'layouts',
      layout: 'default',
      pipeline: {},
      data: {}
    }, options);

    this.options.pipeline = (0, _lodash.reduce)(this.options.pipeline, function (pipeline, tasks, pattern) {
      if (pattern.indexOf('/') === 0) {
        pattern = '**' + pattern;
      } else if (pattern.indexOf('*') < 0 && pattern.indexOf('/') < 0 && pattern.indexOf('.') < 0) {
        pattern = '**/*.' + pattern;
      }
      pipeline[pattern] = (0, _lodash.isArray)(tasks) ? tasks : [tasks];
      return pipeline;
    }, {});

    (0, _lodash.defaults)(this.options.pipeline, {
      '**/*.html': [],
      '**/*.css': [],
      '**/*.js': []
    });
  }

  _createClass(Refrain, [{
    key: 'find',
    value: function find(url) {
      var _this = this;

      url = url.substr(1);
      var pattern = undefined;
      if (_path2['default'].extname(url) === '') {
        pattern = '{' + _path2['default'].join(url, 'index') + ',' + (url.charAt(url.length - 1) === '/' ? url.substr(0, url.length - 1) : url) + '}.html*';
      } else {
        pattern = url + '*';
      }
      var files = _glob2['default'].sync(pattern, {
        cwd: _path2['default'].resolve(this.options.srcDir),
        nodir: true
      });
      if (files.length) {
        var _ret = (function () {
          var file = files[0];
          return {
            v: (0, _lodash.some)(_this.options.pipeline, function (tasks, pattern) {
              return (0, _minimatch2['default'])(file, pattern);
            }) ? file : null
          };
        })();

        if (typeof _ret === 'object') return _ret.v;
      }
      return null;
    }
  }, {
    key: 'defineGetter',
    value: function defineGetter(content) {
      var _this2 = this;

      return Object.defineProperties(content, {
        data: {
          get: function get() {
            var def = {};
            _glob2['default'].sync('*.{yml,yaml,json}', {
              cwd: _path2['default'].resolve(_this2.options.dataDir),
              nodir: true
            }).forEach(function (file) {
              var name = _path2['default'].basename(file, _path2['default'].extname(file));
              Object.defineProperty(def, name, {
                get: function get() {
                  return _this2.data(name);
                }
              });
            });
            return def;
          }
        },
        pages: {
          get: function get() {
            return _this2.pages();
          }
        }
      });
    }
  }, {
    key: 'load',
    value: function load(src, context) {
      context = context || {
        page: {}
      };
      var refrain = this;
      var srcDir = _path2['default'].resolve(refrain.options.srcDir);
      if (src.indexOf('/') !== 0) {
        src = _path2['default'].join(refrain.options.srcDir, src);
      }
      var relativePath = _path2['default'].relative(srcDir, src);
      var str = _fs2['default'].readFileSync(_path2['default'].join(srcDir, relativePath), 'utf-8');
      var match = FRONT_MATTER_REGEX.exec(str);
      var base = _path2['default'].extname(relativePath) === '.html' ? relativePath : relativePath.substr(0, relativePath.length - _path2['default'].extname(relativePath).length);
      base = base.replace(/index.html$/, '').replace(/\\/g, '/');
      var meta = match ? _yamljs2['default'].parse(match[4].trim()) || {} : null;

      var layout = null;
      if (meta) {
        if (meta.layout === undefined && context.page.layout !== refrain.options.layout) {
          layout = refrain.options.layout;
        } else {
          layout = meta.layout;
        }
      }

      var pageData = (0, _lodash.assign)(meta || {}, context.page.data, this.options.data);

      var content = {
        filePath: _path2['default'].resolve(refrain.options.srcDir, relativePath).replace(/\\g/, '/'),
        page: (0, _lodash.assign)({
          path: base.indexOf('/') === 0 ? base : '/' + base,
          filePath: _path2['default'].join(srcDir, src)
        }, context.page, {
          layout: layout,
          data: pageData,
          template: match ? str.substring(match[0].length).trim() : str
        }),
        render: function render(next) {
          refrain.pipeline(content, function (err, output) {
            content.page.body = output;
            next(err);
          });
        }
      };
      return this.defineGetter(content);
    }
  }, {
    key: 'render',
    value: function render(src, context, next) {
      var _this3 = this;

      src = src.replace(/\\/g, '/');
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
        var layoutPath = _path2['default'].join(_path2['default'].relative(_this3.options.srcDir, isRelative ? _path2['default'].dirname(content.filePath) : _this3.options.layoutDir), content.page.layout + '.*').replace(/\\/g, '/');
        var files = _glob2['default'].sync(layoutPath, {
          cwd: _this3.options.srcDir
        });
        if (files.length) {
          layoutPath = files[0];
          if (layoutPath !== src) {
            return _this3.render(layoutPath, content, next);
          }
        }
        _this3.pipeline(content, next);
      });
    }
  }, {
    key: 'pipeline',
    value: function pipeline(content, next) {
      var _this4 = this;

      var tasks = (0, _lodash.find)(this.options.pipeline, function (tasks, pattern) {
        return (0, _minimatch2['default'])(content.filePath, pattern);
      });
      if (tasks) {
        _async2['default'].reduce(tasks, content.page.template, function (text, task, next) {
          if (typeof task === 'string') {
            var modulePath = _path2['default'].resolve('node_modules/refrain-' + task);
            if (!_fs2['default'].existsSync(modulePath)) {
              return next(null, text);
            }
            var _module2 = require(modulePath);
            if (_module2) {
              _module2.call(_this4, text, content, next);
            } else {
              return next(null, text);
            }
          } else if (typeof task === 'function') {
            try {
              task.call(_this4, text, content, next);
            } catch (err) {
              return next(err);
            }
          } else {
            return next('found a illegal pipeline task.');
          }
        }, next);
      } else {
        next(null, content.page.template);
      }
    }
  }, {
    key: 'pages',
    value: function pages() {
      var _this5 = this;

      return _glob2['default'].sync('**/*.html*', {
        cwd: _path2['default'].resolve(this.options.srcDir),
        nodir: true
      }).map(function (file) {
        return _this5.load(file).page;
      });
    }
  }, {
    key: 'data',
    value: function data(name) {
      var srcDir = _path2['default'].resolve(this.options.dataDir);
      return _glob2['default'].sync(name + '.*', {
        cwd: srcDir,
        nodir: true
      }).reduce(function (data, file) {
        switch (_path2['default'].extname(file)) {
          case '.yml':
          case '.yaml':
            (0, _lodash.assign)(data, require('yamljs').parse(_fs2['default'].readFileSync(_path2['default'].join(srcDir, file), 'utf-8')));
            break;
          case '.json':
            (0, _lodash.assign)(data, JSON.parse(_fs2['default'].readFileSync(_path2['default'].join(srcDir, file), 'utf-8')));
            break;
        }
        return data;
      }, {});
    }
  }]);

  return Refrain;
})();

module.exports = function (options) {
  return new Refrain(options);
};
//# sourceMappingURL=data:application/json;base64,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QUM1QixXQUFHLEVBQUUsTUFBTTtBQUNYLGFBQUssRUFBRSxJQUFJO09BQ1osQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFDLElBQUksRUFBRSxJQUFJLEVBQUs7QUFDeEIsZ0JBQVEsa0JBQUssT0FBTyxDQUFDLElBQUksQ0FBQztBQUN4QixlQUFLLE1BQU0sQ0FBQztBQUNaLGVBQUssT0FBTztBQUNWLHdCQWpPRixNQUFNLEVBaU9HLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLGdCQUFHLFlBQVksQ0FBQyxrQkFBSyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RixrQkFBTTtBQUFBLEFBQ1IsZUFBSyxPQUFPO0FBQ1Ysd0JBcE9GLE1BQU0sRUFvT0csSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQUcsWUFBWSxDQUFDLGtCQUFLLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVFLGtCQUFNO0FBQUEsU0FDVDtBQUNELGVBQU8sSUFBSSxDQUFDO09BQ2IsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUNSOzs7U0FqT0csT0FBTzs7O0FBcU9iLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBQSxPQUFPO1NBQUksSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDO0NBQUEsQ0FBQyIsImZpbGUiOiJyZWZyYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5pbXBvcnQgYXN5bmMgZnJvbSAnYXN5bmMnO1xuaW1wb3J0IHthc3NpZ24sIGRlZmF1bHRzLCBmaW5kLCBpc0FycmF5LCByZWR1Y2UsIHNvbWV9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCBtaW5pbWF0Y2ggZnJvbSAnbWluaW1hdGNoJztcbmltcG9ydCBZQU1MIGZyb20gJ3lhbWxqcyc7XG5cbmNvbnN0IEZST05UX01BVFRFUl9SRUdFWCA9IC9eXFxzKigoW15cXHNcXGRcXHddKVxcMnsyLH0pKD86XFx4MjAqKFthLXpdKykpPyhbXFxzXFxTXSo/KVxcMS87XG5cblxuY2xhc3MgUmVmcmFpbiB7XG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ30gW3NyY0Rpcj0nc3JjJ10gVGhlIHNvdXJjZSBkaXJlY3RvcnlcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtkYXRhRGlyPSdkYXRhJ10gVGhlIGRhdGEgZGlyZWN0b3J5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbYnVpbGREaXI9J2J1aWxkJ10gVGhlIGJ1aWxkIGRpcmVjdG9yeVxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2xheW91dERpcj0nbGF5b3V0cyddIFRoZSBsYXlvdXQgZGlyZWN0b3J5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbbGF5b3V0PSdkZWZhdWx0J10gVGhlIGRlZmF1bHQgbGF5b3V0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbcGlwZWxpbmU9e31dIFRoZSBkaWN0aW9uYXJ5IG9mIHBpcGVsaW5lIHRhc2tzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YT17fV0gVGhlIGFkZGl0aW9uYWwgZGF0YSBvYmplY3QsIHRoaXMgbWVyZ2VzIGludG9cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnBhZ2UuZGF0YSBvYmplY3QgYmVmb3JlIHBpcGVsaW5lIHByb2Nlc3NpbmcuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5vcHRpb25zID0gYXNzaWduKHtcbiAgICAgIHNyY0RpcjogJ3NyYycsXG4gICAgICBkYXRhRGlyOiAnZGF0YScsXG4gICAgICBidWlsZERpcjogJ2J1aWxkJyxcbiAgICAgIGxheW91dERpcjogJ2xheW91dHMnLFxuICAgICAgbGF5b3V0OiAnZGVmYXVsdCcsXG4gICAgICBwaXBlbGluZToge30sXG4gICAgICBkYXRhOiB7fVxuICAgIH0sIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5vcHRpb25zLnBpcGVsaW5lID0gcmVkdWNlKHRoaXMub3B0aW9ucy5waXBlbGluZSwgKHBpcGVsaW5lLCB0YXNrcywgcGF0dGVybikgPT4ge1xuICAgICAgaWYgKHBhdHRlcm4uaW5kZXhPZignLycpID09PSAwKSB7XG4gICAgICAgIHBhdHRlcm4gPSBgKioke3BhdHRlcm59YDtcbiAgICAgIH0gZWxzZSBpZiAocGF0dGVybi5pbmRleE9mKCcqJykgPCAwICYmIHBhdHRlcm4uaW5kZXhPZignLycpIDwgMCAmJiBwYXR0ZXJuLmluZGV4T2YoJy4nKSA8IDApIHtcbiAgICAgICAgcGF0dGVybiA9IGAqKi8qLiR7cGF0dGVybn1gO1xuICAgICAgfVxuICAgICAgcGlwZWxpbmVbcGF0dGVybl0gPSBpc0FycmF5KHRhc2tzKSA/IHRhc2tzIDogW3Rhc2tzXTtcbiAgICAgIHJldHVybiBwaXBlbGluZTtcbiAgICB9LCB7fSk7XG5cbiAgICBkZWZhdWx0cyh0aGlzLm9wdGlvbnMucGlwZWxpbmUsIHtcbiAgICAgICcqKi8qLmh0bWwnOiBbXSxcbiAgICAgICcqKi8qLmNzcyc6IFtdLFxuICAgICAgJyoqLyouanMnOiBbXVxuICAgIH0pO1xuICB9XG5cbiAgZmluZCh1cmwpIHtcbiAgICB1cmwgPSB1cmwuc3Vic3RyKDEpO1xuICAgIGxldCBwYXR0ZXJuO1xuICAgIGlmIChwYXRoLmV4dG5hbWUodXJsKSA9PT0gJycpIHtcbiAgICAgIHBhdHRlcm4gPSAneycgKyBwYXRoLmpvaW4odXJsLCAnaW5kZXgnKSArICcsJyArICh1cmwuY2hhckF0KHVybC5sZW5ndGggLSAxKSA9PT0gJy8nID9cbiAgICAgICAgdXJsLnN1YnN0cigwLCB1cmwubGVuZ3RoIC0gMSkgOiB1cmwpICsgJ30uaHRtbConO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXR0ZXJuID0gdXJsICsgJyonO1xuICAgIH1cbiAgICBsZXQgZmlsZXMgPSBnbG9iLnN5bmMocGF0dGVybiwge1xuICAgICAgY3dkOiBwYXRoLnJlc29sdmUodGhpcy5vcHRpb25zLnNyY0RpciksXG4gICAgICBub2RpcjogdHJ1ZVxuICAgIH0pO1xuICAgIGlmIChmaWxlcy5sZW5ndGgpIHtcbiAgICAgIGxldCBmaWxlID0gZmlsZXNbMF07XG4gICAgICByZXR1cm4gc29tZSh0aGlzLm9wdGlvbnMucGlwZWxpbmUsICh0YXNrcywgcGF0dGVybikgPT4gbWluaW1hdGNoKGZpbGUsIHBhdHRlcm4pKSA/IGZpbGUgOiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgZGVmaW5lR2V0dGVyKGNvbnRlbnQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoY29udGVudCwge1xuICAgICAgZGF0YToge1xuICAgICAgICBnZXQ6ICgpID0+IHtcbiAgICAgICAgICBsZXQgZGVmID0ge307XG4gICAgICAgICAgZ2xvYi5zeW5jKCcqLnt5bWwseWFtbCxqc29ufScsIHtcbiAgICAgICAgICAgIGN3ZDogcGF0aC5yZXNvbHZlKHRoaXMub3B0aW9ucy5kYXRhRGlyKSxcbiAgICAgICAgICAgIG5vZGlyOiB0cnVlXG4gICAgICAgICAgfSkuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgIGxldCBuYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlLCBwYXRoLmV4dG5hbWUoZmlsZSkpO1xuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRlZiwgbmFtZSwge1xuICAgICAgICAgICAgICBnZXQ6ICgpID0+IHRoaXMuZGF0YShuYW1lKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIGRlZjtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHBhZ2VzOiB7XG4gICAgICAgIGdldDogKCkgPT4gdGhpcy5wYWdlcygpXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuXG4gIGxvYWQoc3JjLCBjb250ZXh0KSB7XG4gICAgY29udGV4dCA9IGNvbnRleHQgfHwge1xuICAgICAgcGFnZToge31cbiAgICB9O1xuICAgIGxldCByZWZyYWluID0gdGhpcztcbiAgICBsZXQgc3JjRGlyID0gcGF0aC5yZXNvbHZlKHJlZnJhaW4ub3B0aW9ucy5zcmNEaXIpO1xuICAgIGlmIChzcmMuaW5kZXhPZignLycpICE9PSAwKSB7XG4gICAgICBzcmMgPSBwYXRoLmpvaW4ocmVmcmFpbi5vcHRpb25zLnNyY0Rpciwgc3JjKTtcbiAgICB9XG4gICAgbGV0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUoc3JjRGlyLCBzcmMpO1xuICAgIGxldCBzdHIgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHNyY0RpciwgcmVsYXRpdmVQYXRoKSwgJ3V0Zi04Jyk7XG4gICAgbGV0IG1hdGNoID0gRlJPTlRfTUFUVEVSX1JFR0VYLmV4ZWMoc3RyKTtcbiAgICBsZXQgYmFzZSA9IHBhdGguZXh0bmFtZShyZWxhdGl2ZVBhdGgpID09PSAnLmh0bWwnID9cbiAgICAgIHJlbGF0aXZlUGF0aCA6IHJlbGF0aXZlUGF0aC5zdWJzdHIoMCwgcmVsYXRpdmVQYXRoLmxlbmd0aCAtIHBhdGguZXh0bmFtZShyZWxhdGl2ZVBhdGgpLmxlbmd0aCk7XG4gICAgYmFzZSA9IGJhc2UucmVwbGFjZSgvaW5kZXguaHRtbCQvLCAnJykucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGxldCBtZXRhID0gbWF0Y2ggPyBZQU1MLnBhcnNlKG1hdGNoWzRdLnRyaW0oKSkgfHwge30gOiBudWxsO1xuXG4gICAgbGV0IGxheW91dCA9IG51bGw7XG4gICAgaWYgKG1ldGEpIHtcbiAgICAgIGlmIChtZXRhLmxheW91dCA9PT0gdW5kZWZpbmVkICYmIGNvbnRleHQucGFnZS5sYXlvdXQgIT09IHJlZnJhaW4ub3B0aW9ucy5sYXlvdXQpIHtcbiAgICAgICAgbGF5b3V0ID0gcmVmcmFpbi5vcHRpb25zLmxheW91dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxheW91dCA9IG1ldGEubGF5b3V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBwYWdlRGF0YSA9IGFzc2lnbihtZXRhIHx8IHt9LCBjb250ZXh0LnBhZ2UuZGF0YSwgdGhpcy5vcHRpb25zLmRhdGEpO1xuXG4gICAgbGV0IGNvbnRlbnQgPSB7XG4gICAgICBmaWxlUGF0aDogcGF0aC5yZXNvbHZlKHJlZnJhaW4ub3B0aW9ucy5zcmNEaXIsIHJlbGF0aXZlUGF0aCkucmVwbGFjZSgvXFxcXGcvLCAnLycpLFxuICAgICAgcGFnZTogYXNzaWduKHtcbiAgICAgICAgcGF0aDogYmFzZS5pbmRleE9mKCcvJykgPT09IDAgPyBiYXNlIDogJy8nICsgYmFzZSxcbiAgICAgICAgZmlsZVBhdGg6IHBhdGguam9pbihzcmNEaXIsIHNyYylcbiAgICAgIH0sIGNvbnRleHQucGFnZSwge1xuICAgICAgICBsYXlvdXQ6IGxheW91dCxcbiAgICAgICAgZGF0YTogcGFnZURhdGEsXG4gICAgICAgIHRlbXBsYXRlOiBtYXRjaCA/IHN0ci5zdWJzdHJpbmcobWF0Y2hbMF0ubGVuZ3RoKS50cmltKCkgOiBzdHJcbiAgICAgIH0pLFxuICAgICAgcmVuZGVyOiBuZXh0ID0+IHtcbiAgICAgICAgcmVmcmFpbi5waXBlbGluZShjb250ZW50LCAoZXJyLCBvdXRwdXQpID0+IHtcbiAgICAgICAgICBjb250ZW50LnBhZ2UuYm9keSA9IG91dHB1dDtcbiAgICAgICAgICBuZXh0KGVycik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuZGVmaW5lR2V0dGVyKGNvbnRlbnQpO1xuICB9XG5cblxuICByZW5kZXIoc3JjLCBjb250ZXh0LCBuZXh0KSB7XG4gICAgc3JjID0gc3JjLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICBsZXQgY29udGVudCA9IHRoaXMubG9hZChzcmMsIGNvbnRleHQpO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgbmV4dCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnRlbnQucmVuZGVyKGVyciA9PiB7XG4gICAgICBpZiAoZXJyKSByZXR1cm4gbmV4dChlcnIpO1xuXG4gICAgICBpZiAoIWNvbnRlbnQucGFnZS5sYXlvdXQpIHtcbiAgICAgICAgbmV4dChudWxsLCBjb250ZW50LnBhZ2UuYm9keSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGV0IGlzUmVsYXRpdmUgPSBjb250ZW50LnBhZ2UubGF5b3V0LmluZGV4T2YoJy4nKSA9PT0gMDtcbiAgICAgIGxldCBsYXlvdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgICBwYXRoLnJlbGF0aXZlKHRoaXMub3B0aW9ucy5zcmNEaXIsIGlzUmVsYXRpdmUgPyBwYXRoLmRpcm5hbWUoY29udGVudC5maWxlUGF0aCkgOiB0aGlzLm9wdGlvbnMubGF5b3V0RGlyKSxcbiAgICAgICAgY29udGVudC5wYWdlLmxheW91dCArICcuKicpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgIGxldCBmaWxlcyA9IGdsb2Iuc3luYyhsYXlvdXRQYXRoLCB7XG4gICAgICAgIGN3ZDogdGhpcy5vcHRpb25zLnNyY0RpclxuICAgICAgfSk7XG4gICAgICBpZiAoZmlsZXMubGVuZ3RoKSB7XG4gICAgICAgIGxheW91dFBhdGggPSBmaWxlc1swXTtcbiAgICAgICAgaWYgKGxheW91dFBhdGggIT09IHNyYykge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlbmRlcihsYXlvdXRQYXRoLCBjb250ZW50LCBuZXh0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5waXBlbGluZShjb250ZW50LCBuZXh0KTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgcGlwZWxpbmUoY29udGVudCwgbmV4dCkge1xuICAgIGxldCB0YXNrcyA9IGZpbmQodGhpcy5vcHRpb25zLnBpcGVsaW5lLCAodGFza3MsIHBhdHRlcm4pID0+IG1pbmltYXRjaChjb250ZW50LmZpbGVQYXRoLCBwYXR0ZXJuKSk7XG4gICAgaWYgKHRhc2tzKSB7XG4gICAgICBhc3luYy5yZWR1Y2UodGFza3MsIGNvbnRlbnQucGFnZS50ZW1wbGF0ZSwgKHRleHQsIHRhc2ssIG5leHQpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB0YXNrID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGxldCBtb2R1bGVQYXRoID0gcGF0aC5yZXNvbHZlKCdub2RlX21vZHVsZXMvcmVmcmFpbi0nICsgdGFzayk7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKG1vZHVsZVBhdGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dChudWxsLCB0ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IG1vZHVsZSA9IHJlcXVpcmUobW9kdWxlUGF0aCk7XG4gICAgICAgICAgaWYgKG1vZHVsZSkge1xuICAgICAgICAgICAgbW9kdWxlLmNhbGwodGhpcywgdGV4dCwgY29udGVudCwgbmV4dCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBuZXh0KG51bGwsIHRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGFzayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0YXNrLmNhbGwodGhpcywgdGV4dCwgY29udGVudCwgbmV4dCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dChlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbmV4dCgnZm91bmQgYSBpbGxlZ2FsIHBpcGVsaW5lIHRhc2suJyk7XG4gICAgICAgIH1cbiAgICAgIH0sIG5leHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0KG51bGwsIGNvbnRlbnQucGFnZS50ZW1wbGF0ZSk7XG4gICAgfVxuICB9XG5cblxuICBwYWdlcygpIHtcbiAgICByZXR1cm4gZ2xvYi5zeW5jKCcqKi8qLmh0bWwqJywge1xuICAgICAgY3dkOiBwYXRoLnJlc29sdmUodGhpcy5vcHRpb25zLnNyY0RpciksXG4gICAgICBub2RpcjogdHJ1ZVxuICAgIH0pLm1hcChmaWxlID0+IHRoaXMubG9hZChmaWxlKS5wYWdlKTtcbiAgfVxuXG5cbiAgZGF0YShuYW1lKSB7XG4gICAgbGV0IHNyY0RpciA9IHBhdGgucmVzb2x2ZSh0aGlzLm9wdGlvbnMuZGF0YURpcik7XG4gICAgcmV0dXJuIGdsb2Iuc3luYyhuYW1lICsgJy4qJywge1xuICAgICAgY3dkOiBzcmNEaXIsXG4gICAgICBub2RpcjogdHJ1ZVxuICAgIH0pLnJlZHVjZSgoZGF0YSwgZmlsZSkgPT4ge1xuICAgICAgc3dpdGNoIChwYXRoLmV4dG5hbWUoZmlsZSkpIHtcbiAgICAgICAgY2FzZSAnLnltbCc6XG4gICAgICAgIGNhc2UgJy55YW1sJzpcbiAgICAgICAgICBhc3NpZ24oZGF0YSwgcmVxdWlyZSgneWFtbGpzJykucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihzcmNEaXIsIGZpbGUpLCAndXRmLTgnKSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcuanNvbic6XG4gICAgICAgICAgYXNzaWduKGRhdGEsIEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihzcmNEaXIsIGZpbGUpLCAndXRmLTgnKSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSwge30pO1xuICB9XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBvcHRpb25zID0+IG5ldyBSZWZyYWluKG9wdGlvbnMpO1xuIl19