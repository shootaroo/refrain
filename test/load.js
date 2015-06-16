/* global describe, it */
'use strict';

import assert from 'power-assert';
import createRefrain from '../src/refrain';


describe('load', () => {

  it('creates the refrain context', () => {

    let refrain = createRefrain({
      srcDir: 'test/assets'
    });

    let context = refrain.load('find1.html', null);

    assert(context != null);
    assert(typeof context === 'object');

  });

  it('merges the refrain.options.data into context.page.data', () => {

    let refrain = createRefrain({
      srcDir: 'test/assets',
      data: {foo: 'bar'}
    });

    let context = refrain.load('find1.html', null);

    assert(context.page.data.foo === 'bar');

  });

});
