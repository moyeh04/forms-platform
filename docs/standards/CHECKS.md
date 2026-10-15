# Checks

Every rule a script can check is checked by `scripts/checks/run-checks.js`.
The rules are written in the other pages of `docs/standards/`; this page says
which check enforces each one, what it refuses, and how to fix a refusal.

```
npm run check                                  # every tracked file
node scripts/checks/run-checks.js --staged     # the staged files
npm run check -- --update-baseline             # write down what was fixed
```

The git hook `.githooks/pre-commit` runs the staged form before every commit.

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

| Check | Refuses | Fix |
|---|---|---|
| `check-biome.js` | anything Biome reports above "info" on the JavaScript, CSS and JSON files: layout (`biome/format`), lint rules, the size limits and unnamed numbers of [CODING_STYLE.md](CODING_STYLE.md) | `npx biome format --write <file>` for layout; otherwise change the code, or silence one line with `// biome-ignore <rule>: <reason>` |
| `check-lines.js` | a line wider than 80 columns (Google §4.4) in JavaScript, CSS, HTML, shell, YAML, JSON and the git hooks; Arabic counts by character, and a URL does not count because it cannot be broken | split the string or the comment; Biome wraps code by itself |
| `check-jsdoc.js` | a named function in `assets/js`, `backend`, `shared` or `scripts` without a JSDoc comment, without a summary, with `@param` tags that do not match its parameters, without a `{type}`, without `@return` when it returns a value or with one when it does not, `@returns` for `@return`, or a metadata tag such as `@author` ([DOCUMENTATION.md](DOCUMENTATION.md)) | write or correct the comment above the function |
| `check-docs.js` | an action of the backend with no row in [API.md](../backend/API.md), or a row with no action; a total or a row of [TESTING.md](../process/TESTING.md) that does not match the tests in `tests/` and its sub-folders; a Markdown link to a file that does not exist | correct the document in the same commit as the code |
