const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Phones: every Egyptian format maps to 01XXXXXXXXX', () => {
  for (const p of [
    '01012345678',
    '+201012345678',
    '00201012345678',
    '201012345678',
    '1012345678',
    '+20 10 1234 5678',
    '٠١٠١٢٣٤٥٦٧٨'
  ]) {
    assert.equal(R.normalizePhone(p), '01012345678', p);
  }
  assert.equal(R.normalizePhone('01312345678'), '');
  assert.equal(R.normalizePhone('12345'), '');
  assert.equal(
    R.whatsappLink('+20 101 234 5678'),
    'https://wa.me/201012345678',
    'WhatsApp takes the number with the country code'
  );
  assert.equal(
    R.whatsappLink('12345'),
    '',
    'and there is no link for a number that is not a mobile'
  );
});

test('Phones: extracts numbers from pasted WhatsApp lines', () => {
  const found = R.extractPhones('Sara Ali +20 10 1234 5678');
  assert.equal(found.length, 1);
  assert.equal(found[0].phone, '01012345678');
  assert.equal(R.extractPhones('no number here').length, 0);
});
