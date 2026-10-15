# Checks

Every rule a script can check is checked by `scripts/checks/run-checks.js`.
The rules are written in the other pages of `docs/standards/`; this page says
which check enforces each one, what it refuses, and how to fix a refusal.

```
npm run check                                  # every tracked file
node scripts/checks/run-checks.js --staged     # the staged files
npm run check -- --update-baseline             # write down what was fixed
```

Three places run them:

| Where | What runs |
|---|---|
| `.githooks/pre-commit` | the staged form, before every commit |
| `.githooks/pre-push` | the full form and the tests of the checks, before every push |
| `.github/workflows/pages.yml` | `npm run check` before `npm test`, so a push that breaks a rule never deploys |

`npm install` points git at `.githooks`. A hook can be skipped on one
machine; CI cannot.

## How a run decides

1. Each check looks at the files of the run and reports findings: a file, a
   line, a rule and a message.
2. `exceptions.json` removes the findings it covers. An entry names a path, a
   rule and a reason of at least four words. A weak reason fails, and so does
   an entry that matches nothing in a full run.
3. `baseline.json` gives the number of findings of each rule that an old file
   may still have. More than that fails. A new file has no allowance, so new
   code meets every rule from its first commit.
4. A count that went down must be written down in the same commit
   (`--update-baseline`), so the baseline only shrinks. `--update-baseline`
   never raises a count; a higher count can only come from editing the file
   by hand, which a reviewer sees.

Every path a check covers and every limit a rule sets is in
`scripts/checks/config.json`, not in the code.

## The checks

The checks that read one file at a time are in `scripts/checks/code/`; the
ones that look at the whole tree (its layout and its documents) are in
`scripts/checks/tree/`. Their tests mirror them under `tests/scripts/checks/`.

| Check | Refuses | Fix |
|---|---|---|
| `check-biome.js` | anything Biome reports above "info" on the JavaScript, CSS and JSON files: layout (`biome/format`), lint rules, the size limits and unnamed numbers of [CODING_STYLE.md](CODING_STYLE.md) | `npx biome format --write <file>` for layout; otherwise change the code, or silence one line with `// biome-ignore <rule>: <reason>` |
| `check-lines.js` | a line wider than 80 columns (Google §4.4) in JavaScript, CSS, HTML, shell, YAML, JSON and the git hooks; Arabic counts by character, and a URL does not count because it cannot be broken | split the string or the comment; Biome wraps code by itself |
| `check-jsdoc.js` | a named function in `assets/js`, `backend`, `shared` or `scripts` without a JSDoc comment, without a summary, with `@param` tags that do not match its parameters, without a `{type}`, without `@return` when it returns a value or with one when it does not, `@returns` for `@return`, or a metadata tag such as `@author` ([DOCUMENTATION.md](DOCUMENTATION.md)) | write or correct the comment above the function |
| `check-numbers.js` | a number that initialises a variable, a property or a default parameter, which Biome skips, unless a CONSTANT_CASE name holds it ([CONSTANTS.md](CONSTANTS.md)); it honours Biome's ignore comment | move the number into a named constant at the top of the file |
| `check-enums.js` | a string compared with a property that `enums.properties` in `config.json` maps to an enum of `domain/enums.js`, or a `case` of a `switch` on it, when the string is a value of that enum (`form.type === 'reservation'`). A string the enum does not hold passes, since the same property names other words too (question types, view kinds, transfer statuses) | write the member: `form.type === FormType.RESERVATION`; an enum enters the map in the commit that moves its code to the members |
| `check-layers.js` | a backend file that reads a namespace its layer may not, by the rules under `layers` in `config.json`: code under `backend/platform/` reading a feature, or a `*.controller.js` reading a `*.repository.js`. Each file defines the namespace named after it, so the read names the file it reaches | move the call into the service of the feature, or pass what the platform needs in as an argument |
| `check-flags.js` | outside `backend/platform/sheets/cell.js`, a field (`row.done` or `String(row.done)`) compared with `'1'` or `'0'`, or a choice that writes `'1'` or `'0'` ([CONSTANTS.md](CONSTANTS.md)) | keep the value a boolean and convert it with `Cell.readFlag` or `Cell.writeFlag` where the row is read or written |
| `check-structure.js` | a root entry not on the allow-list, a catch-all name such as `utils`, a page loading a file that does not exist or a script no page loads, a source file [FILE-STRUCTURE.md](../architecture/FILE-STRUCTURE.md) does not name ([the structure rules](../architecture/FILE-STRUCTURE.md#structure-rules)); a folder is named with a trailing `/` | move or rename the file, or add its row to FILE-STRUCTURE.md |
| `check-docs.js` | an action of the routes table with no row in [API.md](../backend/API.md), a row with no action, or a row in the section of another access than its route (`accessSections` in `config.json`); a total or a row of [TESTING.md](../process/TESTING.md) that does not match the tests in `tests/` and its sub-folders; a Markdown link to a file that does not exist | correct the document in the same commit as the code |
