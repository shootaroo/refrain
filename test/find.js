/* global it */
'use strict';
var assert = require('power-assert');


it('find1', () => {
  var refrain = require('../src/refrain')({
    srcDir: 'test/assets'
  });

  assert(refrain.find('/find1') === 'find1.html');
  assert(refrain.find('/find1/') === 'find1.html');
  assert(refrain.find('/find1.html') === 'find1.html');
  assert(refrain.find('/find2.html') === null);
  assert(refrain.find('/css/find1.css') === 'css/find1.css');
  assert(refrain.find('/css/find2.css') === null);
  assert(refrain.find('/js/find1.js') === 'js/find1.js');
  assert(refrain.find('/js/find2.js') === null);
});


it('find2 pipeline', () => {
  var refrain = require('../src/refrain')({
    srcDir: 'test/assets',
    pipeline: {
      ejs: [],
      less: [],
      coffee: []
    }
  });

  assert(refrain.find('/find2') === 'find2.html.ejs');
  assert(refrain.find('/find2/') === 'find2.html.ejs');
  assert(refrain.find('/find2.html') === 'find2.html.ejs');
  assert(refrain.find('/find1') === 'find1.html');
  assert(refrain.find('/css/find1.css') === 'css/find1.css');
  assert(refrain.find('/css/find2.css') === 'css/find2.css.less');
  assert(refrain.find('/js/find1.js') === 'js/find1.js');
  assert(refrain.find('/js/find2.js') === 'js/find2.js.coffee');
});
