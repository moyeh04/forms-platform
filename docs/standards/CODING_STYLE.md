# Coding style

The project follows the
[Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
and checks it with [Biome](https://biomejs.dev/). The settings live in
`biome.json` at the root. This page says what they are and why.

## Formatting

Biome's formatter owns the layout. Do not lay code out by hand.

| Setting | Value | Source |
|---|---|---|
| Indent | 2 spaces | Google §4.2 |
| Line width | 80 columns | Google §4.4 |
| Quotes | single | Google §5.6.1 |
| Semicolons | always | Google §4.3.2 |
| Trailing commas | none | the files run in Apps Script and old browsers alike |
| Arrow parameters | always in parentheses | one shape for every arrow |

`npx biome format --write <file>` lays a file out. `npx biome check <file>`
reports what is wrong without changing anything.

## Lint rules

Biome's recommended preset is on, with these sizes as errors. The numbers are
Biome's defaults, not chosen by hand:

| Rule | Limit | What it stops |
|---|---|---|
| `complexity/noExcessiveCognitiveComplexity` | 15 | a function that does too many things at once |
| `complexity/noExcessiveLinesPerFunction` | 50 lines, blank lines not counted, the wrapping IIFE not counted | long functions |
| `style/noExcessiveLinesPerFile` | 300 lines | a file with more than one job |
| `complexity/useMaxParams` | 4 parameters | long parameter lists; pass one options object instead |
| `style/noMagicNumbers` | error | unnamed numbers (see CONSTANTS.md) |

Rules turned off, each for a reason:

| Rule | Why it is off |
|---|---|
| `complexity/useArrowFunction` | the browser files are classic scripts wrapped in `(function (App) { … })(window.App)`, and the backend is Apps Script globals; both are written with `function` |
| `suspicious/noRedundantUseStrict` | the browser files are classic scripts, not modules, so `'use strict'` inside their wrapper is not redundant |

Tests are exempt from the size rules and from `noMagicNumbers`: an expected
value in an assertion is data.

A finding that is right to keep is silenced on its own line with the reason:

```js
// biome-ignore lint/style/noMagicNumbers: the RFC fixes this length
```
