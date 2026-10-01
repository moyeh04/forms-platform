/**
 * Colour contrast: every text and control colour pair the pages use must meet
 * WCAG 2.1 AA in both themes, read straight from assets/css/theme.css.
 * Text needs 4.5:1; field outlines and the focus ring need 3:1.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'theme.css'), 'utf8');

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}

function blockAfter(marker) {
  const start = css.indexOf(marker);
  assert.ok(start !== -1, 'theme.css has ' + marker);
  return css.slice(start, css.indexOf('}', start));
}

const light = tokens(blockAfter(':root {'));
const darkToggle = { ...light, ...tokens(blockAfter(':root[data-theme="dark"]')) };
const darkDevice = { ...light, ...tokens(blockAfter(':root:not([data-theme="light"])')) };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, where it is used]
const PAIRS = [
  ['ink', 'sheet', 4.5, 'body text'],
  ['ink', 'desk', 4.5, 'text on the page background'],
  ['ink', 'sheet-2', 4.5, 'text on raised panels'],
  ['mute', 'sheet', 4.5, 'help text'],
  ['mute', 'desk', 4.5, 'help text on the page background'],
  ['mute', 'sheet-2', 4.5, 'help text on raised panels'],
  ['accent', 'sheet', 4.5, 'term tag, hints, trail'],
  ['sea', 'sheet', 4.5, 'links'],
  ['err', 'sheet', 4.5, 'error messages'],
  ['on-accent', 'accent', 4.5, 'primary buttons'],
  ['on-sea', 'sea', 4.5, 'Open badge, chosen chips'],
  ['sheet', 'sea', 4.5, 'teal team pill'],
  ['sheet', 'gold', 4.5, 'gold team pill'],
  ['gold', 'sheet', 4.5, 'leader tag'],
  ['ink', 'tint-a', 4.5, 'audience line, size note'],
  ['ink', 'tint-b', 4.5, 'tinted rows'],
  ['field-line', 'sheet', 3, 'input and chip outlines'],
  ['field-line', 'desk', 3, 'outlines on the page background'],
  ['field-line', 'sheet-2', 3, 'outlines on raised panels'],
  ['focus', 'sheet', 3, 'focus ring']
];

for (const [name, theme] of [['light', light], ['dark (toggle)', darkToggle], ['dark (device)', darkDevice]]) {
  test(`Contrast: ${name} theme meets WCAG AA for every pair the pages use`, () => {
    const failures = PAIRS.filter(([fg, bg, min]) => ratio(theme[fg], theme[bg]) < min)
      .map(([fg, bg, min, use]) => `${fg} on ${bg} (${use}): ${ratio(theme[fg], theme[bg]).toFixed(2)} < ${min}`);
    assert.deepEqual(failures, []);
  });
}

test('Contrast: the device dark theme and the dark toggle use the same colours', () => {
  assert.deepEqual(darkDevice, darkToggle);
});
