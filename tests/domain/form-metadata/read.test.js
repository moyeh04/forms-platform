const test = require('node:test');
const assert = require('node:assert/strict');
const read = require('../../../domain/form-metadata/read.js');
const batch = require('../../../domain/form-metadata/batch.js');

test(
  'Term: a season belongs to the ' + 'academic year that starts in its year',
  () => {
    assert.deepEqual(read.termParts('Spring 2026'), {
      season: 'Spring',
      year: '2026/2027',
      custom: ''
    });
    assert.equal(read.termParts('fall 2025').season, 'Fall');
    assert.equal(read.termParts('Summer 2027/2028').year, '2027/2028');
    assert.deepEqual(read.termParts(' Term 3 '), {
      season: '',
      year: '',
      custom: 'Term 3'
    });
    assert.equal(read.academicYear('Spring 2026'), '2026/2027');
  }
);

test('Term: an older WhatsApp form reads its batch year the same way', () => {
  const form = { type: 'whatsapp_registration', term: 'Spring 2026' };
  assert.equal(batch.read(form).batchYear, '2026/2027');
});
