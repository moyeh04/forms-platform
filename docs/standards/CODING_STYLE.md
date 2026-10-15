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

Biome wraps code at 80 columns but cannot break a long string or comment;
`check-lines.js` refuses those (see [CHECKS.md](CHECKS.md)). Split the string
with `+`, or move it into a constant.

The whole tree was laid out by Biome once, one commit per folder. Those
commits change only layout, and `.git-blame-ignore-revs` lists them so
`git blame` shows who wrote a line, not who formatted it. `npm install` sets
`blame.ignoreRevsFile`; GitHub reads the file by itself. A later commit that
only changes layout is added to the list.

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
| `style/noMagicNumbers` | error | unnamed numbers (see [CONSTANTS.md](CONSTANTS.md)) |

Rules turned off, each for a reason:

| Rule | Why it is off |
|---|---|
| `complexity/useArrowFunction` | the browser files are classic scripts wrapped in `(function (App) { … })(window.App)`, and the backend is Apps Script globals; both are written with `function` |
| `suspicious/noRedundantUseStrict` | the browser files are classic scripts, not modules, so `'use strict'` inside their wrapper is not redundant |

Two rules are off for `backend/` only. The bundler joins every backend file
into one Apps Script file, so they share one global scope that Biome, which
reads one file at a time, cannot see:

| Rule | Why it is off in `backend/` |
|---|---|
| `correctness/noUnusedVariables` | a top-level function is called by Apps Script (`doGet`, `doPost`, menu items, triggers) or by another backend file, so Biome reports it as unused |
| `correctness/noInvalidUseBeforeDeclaration` | each file joins the shared handler table with `var API = API \|\| {}`, which reads `API` before the declaration in the same file |

Tests are exempt from the size rules and from `noMagicNumbers`: an expected
value in an assertion is data.

A finding that is right to keep is silenced on its own line with the reason:

```js
// biome-ignore lint/style/noMagicNumbers: the RFC fixes this length
```
