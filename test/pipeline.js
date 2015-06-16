/* global describe, it */
'use strict';

var assert = require('power-assert');

describe('pipeline', () => {

  it('pattern matched', () => {
    var refrain = require('../src/refrain')({
      srcDir: 'test/assets',
      pipeline: {
        '/js/deps.js': (text, context, callback) => callback(null, 'deps'),
        '**/*.js': (text, context, callback) => callback(null, 'others')
      }
    });

    refrain.pipeline({filePath: '/js/deps.js', page: {template: ''}}, (err, result) => assert(result === 'deps'));
    refrain.pipeline({filePath: '/js/find1.js', page: {template: ''}}, (err, result) => assert(result === 'others'));
  });

});
