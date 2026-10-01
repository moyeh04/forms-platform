const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

test('Harness: loads the bundle with shared rules available', () => {
  const w = createWorld();
  assert.equal(w.ctx.Rules.normalizePhone('+201012345678'), '01012345678');
});

test('Harness: sheets store, append, delete rows and read back', () => {
  const w = createWorld();
  const ss = w.ctx.SpreadsheetApp.create('T');
  const sh = ss.insertSheet('Data');
  sh.appendRow(['a', 1]);
  sh.appendRow(['b', 2]);
  sh.getRange(3, 1, 1, 2).setValues([['c', 3]]);
  assert.equal(sh.getLastRow(), 3);
  sh.deleteRow(2);
  assert.deepEqual(sh.getDataRange().getValues(), [['a', 1], ['c', 3]]);
  sh.getRange(1, 1).setBackground('#fff').setFontWeight('bold');
});

test('Harness: digest matches Apps Script signed-byte output', () => {
  const w = createWorld();
  const d = w.ctx.Utilities.computeDigest(w.ctx.Utilities.DigestAlgorithm.SHA_256, 'abc');
  assert.equal(d.length, 32);
  assert.ok(d.every((b) => b >= -128 && b <= 127));
});

test('Harness: clock and cache respect the controlled time', () => {
  const w = createWorld({ now: Date.parse('2027-09-01T00:00:00Z') });
  const cache = w.ctx.CacheService.getScriptCache();
  cache.put('k', 'v', 60);
  assert.equal(cache.get('k'), 'v');
  w.advanceDays(1);
  assert.equal(cache.get('k'), null);
  assert.equal(new w.ctx.Date().toISOString(), '2027-09-02T00:00:00.000Z');
});
