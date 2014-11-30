'use strict';
var assert = require('power-assert');
var refrain = require('./');

it('find', function () {
  var engine = refrain({
    srcDir: 'example'
  });
  assert(engine.find('/') === 'index.html.ejs');
  assert(engine.find('/index.html') === 'index.html.ejs');
  assert(engine.find('/sample') === 'sample/index.html.ejs');
  assert(engine.find('/sample/') === 'sample/index.html.ejs');
  assert(engine.find('/sample/test1') === 'sample/test1.html.ejs');
  assert(engine.find('/sample/test1/') === 'sample/test1.html.ejs');
  assert(engine.find('/sample/test1.html') === 'sample/test1.html.ejs');
  assert(engine.find('/sample/test2') === 'sample/test2.html');
  assert(engine.find('/sample/test2/') === 'sample/test2.html');
  assert(engine.find('/sample/test2.html') === 'sample/test2.html');
  assert(engine.find('/css/style.css') === null);
});
