/* global it, describe */

var assert = require('power-assert');
var createRefrain = require('../src/refrain');


describe('refrain', () => {
  'use strict';

  describe('load', () => {

    it('creates the refrain context', () => {

      var refrain = createRefrain({
        srcDir: 'test/assets'
      });

      var context = refrain.load('find1.html', null);

      assert(context != null);
      assert(typeof context === 'object');

    });

    it('merges the refrain.options.data into context.page.data', () => {

      var refrain = createRefrain({
        srcDir: 'test/assets',
        data: {foo: 'bar'}
      });

      var context = refrain.load('find1.html', null);

      assert(context.page.data.foo === 'bar');

    });

  });

});
