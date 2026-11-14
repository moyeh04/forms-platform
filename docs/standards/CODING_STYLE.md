# Coding style

The project follows the
[Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
for naming, comments and JSDoc. [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)
lays out every file, [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) checks the
scripts and [Stylelint](https://stylelint.io/) checks the stylesheets. Their settings live in
`.oxfmtrc.json`, `.oxlintrc.json` and `stylelint.config.mjs` at the root. This page says what
they are and why.

## Formatting

Oxfmt owns the layout of the JavaScript, CSS, JSON, HTML, Markdown and YAML files. Do not lay
code out by hand. It runs at its defaults, so `.oxfmtrc.json` only turns on sorted imports:

| Setting         | Value                      | Why                                                                                          |
| --------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| Indent          | 2 spaces                   | Oxfmt's default, as Google §4.2                                                              |
| Line width      | 100 columns, in every file | Oxfmt's default                                                                              |
| Quotes          | double                     | Oxfmt's default                                                                              |
| Semicolons      | always                     | Google §4.3.2                                                                                |
| Trailing commas | everywhere                 | Oxfmt's default; the pages already need ES2020 and Apps Script runs on V8, so both read them |

`tests/fixtures/` is left alone: the golden test compares those files byte for byte.

Oxfmt wraps code at its width but cannot break a long string or comment; `check-lines.js`
refuses those (see [CHECKS.md](CHECKS.md)). Rewrap the comment, or split the string with `+`
across lines or move it into a constant.

The whole tree was laid out once by Biome, one commit per folder, and once more by Oxfmt.
Those commits change only layout, and `.git-blame-ignore-revs` lists them so `git blame` shows
who wrote a line, not who formatted it. `pnpm install` sets `blame.ignoreRevsFile`; GitHub
reads the file by itself. A later commit that only changes layout is added to the list.

`pnpm fmt` lays the tree out; `pnpm exec oxfmt <file>` lays out one file. `pnpm lint` runs
Oxlint with types and Stylelint and changes nothing.

## Lint rules

Oxlint runs the correctness, suspicious and perf rule groups as errors, with types (through
oxlint-tsgolint) in `pnpm lint`, `pnpm run check` and CI, and without them in the pre-commit
hook, which stays fast. These sizes are errors too:

| Rule                                     | Limit                                                            | What it stops                                         |
| ---------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `complexity`                             | 20                                                               | a function that does too many things at once          |
| `max-lines-per-function`                 | 50 lines, blank lines not counted, the wrapping IIFE not counted | long functions                                        |
| `max-lines`                              | 300 lines                                                        | a file with more than one job                         |
| `max-params`                             | 4 parameters                                                     | long parameter lists; pass one options object instead |
| `no-magic-numbers`                       | error                                                            | unnamed numbers (see [CONSTANTS.md](CONSTANTS.md))    |
| `import/no-cycle`                        | error                                                            | two modules that need each other                      |
| `typescript/switch-exhaustiveness-check` | error                                                            | a switch that misses a case of its enum               |

Ten files older than the file limit are exempt from `max-lines` in `.oxlintrc.json` until
each is split.

Rules turned off, each for a reason, which `.oxlintrc.json` repeats beside the rule:

| Rule                                                                                                                                                 | Why it is off                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `typescript/prefer-nullish-coalescing`, `no-redundant-type-constituents`, `no-unnecessary-type-conversion`, `consistent-return`, `no-misused-spread` | the code is untyped JavaScript, so the type checker reads JSDoc and sheet values as `any` and these rules misread them |
| `no-underscore-dangle`                                                                                                                               | a trailing `_` marks a private Apps Script function, which the editor's Run list hides                                 |

Two rules are off for some folders only:

| Rule                    | Off in                        | Why                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-unused-vars`        | `backend/`                    | the bundler joins every backend file into one Apps Script file, so each file defines a namespace other files call, and `entry-points.js` and `main.js` define the functions Apps Script calls by name (`doGet`, `doPost`, menu items, triggers) |
| `unicorn/no-array-sort` | `backend/`, `domain/`, `web/` | Apps Script and older phones may lack `toSorted()`; the sorts there are on fresh arrays                                                                                                                                                         |

Tests are exempt from the size rules, `no-magic-numbers` and `no-useless-concat`: an expected
value in an assertion is data, and a long test name is split with `+` to fit the width.

A finding that is right to keep is silenced on its own line with the reason:

```js
// oxlint-disable-next-line no-magic-numbers -- the RFC fixes this length
```

## Stylesheets

Stylelint runs `stylelint-config-standard`, with these project rules:

| Rule                                                    | What it holds                                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale-unlimited/declaration-strict-value`              | a colour comes from a token of `web/css/theme.css` (`var(--…)`), or is `currentcolor`, `transparent` or `inherit`; theme.css is exempt                                                                                                                                       |
| `property-disallowed-list`                              | no physical side (`margin-left`, `left`, `border-right`, the corner radii): the Arabic pages mirror, so sides are logical (`margin-inline-start`, `inset-inline-end`). The ticket and the island trail place parts on a picture that does not mirror and keep physical sides |
| `declaration-property-value-disallowed-list`            | `text-align`, `float` and `clear` take `start` or `end`, not `left` or `right`                                                                                                                                                                                               |
| `media-feature-range-notation`, `selector-not-notation` | `min-width` queries and one selector per `:not()`, which older phones read                                                                                                                                                                                                   |
| `property-no-vendor-prefix`                             | allows `-webkit-mask` and `-webkit-text-size-adjust`, which older Chrome and Safari need                                                                                                                                                                                     |

Font sizes are not tied to tokens yet: the type tokens name roles, and the sizes the pages set
do not map onto them. A comment `/* stylelint-disable-next-line <rule> -- <reason> */` silences
one line.
