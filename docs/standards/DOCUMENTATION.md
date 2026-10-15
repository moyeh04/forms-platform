# Documentation comments

Every named function carries a JSDoc comment written the way the
[Google JavaScript Style Guide §7](https://google.github.io/styleguide/jsguide.html#jsdoc)
writes it. `scripts/checks/code/check-jsdoc.js` checks the shape (see
[CHECKS.md](CHECKS.md)); whether the words are true is for the reviewer.

## The shape

```js
/**
 * Finds the reservation a student holds in one slot.
 *
 * @param {string} slotId The slot.
 * @param {string} studentCode The student's code.
 * @return {?Object} The reservation, or null when there is none.
 */
function findReservation(slotId, studentCode) {
```

- A summary first: one sentence that says what the function does, not how.
  More sentences may follow when the reader needs them.
- One `@param {Type} name Description.` for each parameter, in order. An
  optional parameter is `{Type=}`, a rest parameter `{...Type}`. A
  destructured parameter gets a name in the tag and its fields as
  `@param {string} options.name`.
- `@return {Type} Description.` when the function returns a value. Google
  writes `@return`, not `@returns`. A function that returns nothing has no
  `@return`; an async one may have `@return {!Promise<Type>}`.
- Types use Google's notation: `!Object` cannot be null, `?Object` can,
  `!Array<string>`, `!Object<string, number>`, `{{name: string}}` for a
  record.
- A continuation line is indented four spaces under the tag.

## What carries no comment

- A function passed straight to a call, such as the callback of `forEach` or
  the wrapper `(function (App) { … })(window.App)`, and a function inside an
  object literal passed straight to a call, such as a Proxy handler. Name
  and document it when it does enough to need a comment.
- Tests. A test's title says what it checks.

## No metadata

Git keeps who wrote a line, when, and in which version. A comment that
repeats it goes stale on the first edit, so these tags are refused:
`@author`, `@date`, `@since`, `@version`, `@copyright`, `@license`,
`@created`, `@modified`, `@file`, `@fileoverview`.

A file starts with a plain block comment that says what the file is for,
without a tag.

## Inline comments

A `//` comment inside a function says why, when the code cannot: a rule from
the product, a limit of Apps Script, a browser quirk. It does not repeat what
the next line does.

## Shell scripts, git hooks and workflows

The files that are not JavaScript carry `#` comments under the same rules:
they say what and why, never who or when.

- A shell script or git hook has a comment block right under its `#!` line
  that says what it does and when it runs: on `npm install`, before each
  commit, before each push.
- A CI workflow starts with a comment block that says what it runs, on which
  events, and what it deploys.
- Every job has a comment line above it that says why the job exists and why
  it runs when it does: the condition of its `if:`, what it waits for.
- A step whose reason is not in its name gets a comment above it: a pinned
  version, a step that runs `always()`, a check that stops the deploy.

`scripts/checks/code/check-comments.js` checks the header of each script and
workflow and the comment above each job; whether a step needs one is for the
reviewer.
