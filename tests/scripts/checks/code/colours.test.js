const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSource
} = require('../../../../scripts/checks/code/check-colours.js');

const PALETTE = 'theme.css';
const problems = (file, source) =>
  checkSource(file, source, PALETTE).map(
    (f) => `${f.line} ${f.message.split(' ')[0]}`
  );

test('Colour check: the palette names colours in custom properties', () => {
  const source = `
:root {
  --ink: #2f2418;
  --shadow: rgba(47, 36, 24, 0.16);
  --paper: white;
}
`;
  assert.deepEqual(problems(PALETTE, source), []);
});

test('Colour check: a colour written out elsewhere is found', () => {
  const source = `
.a {
  color: #c62828;
  background: linear-gradient(rgba(0, 0, 0, 0.5), hsl(0 0% 50%));
  --frame: #2a1c12;
  border-color: white;
}
`;
  assert.deepEqual(problems('a.css', source), [
    '3 #c62828',
    '4 rgba()',
    '4 hsl()',
    '5 #2a1c12',
    '6 white'
  ]);
});

test('Colour check: the palette outside a custom property is found', () => {
  const source = 'body {\n  background: #fff;\n}\n';
  assert.deepEqual(problems(PALETTE, source), ['2 #fff']);
});

test('Colour check: names, keywords and look-alikes pass', () => {
  const source = `
/* A comment may say #fff or white. */
#main:not([data-theme="red"]) .tan {
  color: var(--ink);
  border: 1px solid transparent;
  fill: currentColor;
  background: color-mix(in srgb, var(--line) 70%, transparent);
  white-space: nowrap;
  font-family: "Snow White", Georgia, serif;
  background-image: url(img/red.svg#fff);
}
`;
  assert.deepEqual(problems('a.css', source), []);
});
