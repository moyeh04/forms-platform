const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Codes: seven digits by default', () => {
  assert.equal(R.validateCode('4230999').ok, true);
  assert.equal(R.validateCode('٤٢٣٠٩٩٩').value, '4230999');
  assert.equal(R.validateCode('42309').error, 'invalid_code');
  assert.equal(R.validateCode('42A0999').error, 'invalid_code');
});
