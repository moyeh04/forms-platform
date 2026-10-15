# Constants

A number or a fixed string that means something gets a name. The name says
what the value is, and the one place that declares it is the only place to
change it.

## Rules

- **CONSTANT_CASE.** `const WAIT_MS = 5000;` A backend constant private to
  its file ends in `_`, as Apps Script private names do: `DL_BUDGET_MS_`.
- **The unit is in the name** when the value has one: `_MS`, `_SECONDS`,
  `_DAYS`, `_BYTES`, `_PX`.
- **Declared at the top of the file that owns it**, under the imports, never
  inside a function. A value two files need belongs to the lower layer they
  share: `backend/platform/config/constants.js` for the backend, a part of
  `domain/rules/` for both sides.
- **Built from smaller names** when it is a product: `40 * 1024 * 1024`
  stays readable, so write it out instead of `41943040`.
- **A vocabulary is one enum.** The words the pages and the backend share
  (`FormType`, `FormStatus`, `ReviewStatus`, `ListKind`) are frozen enums in
  `domain/enums.js`. Code compares with the member, `FormStatus.DRAFT`, never
  with `'draft'`, and checks a value against `Object.values(FormStatus)`.
  `check-enums.js` refuses a word of a mapped enum written by hand. A
  vocabulary only the backend uses is a frozen object in
  `backend/platform/config/`, such as `Access`.
- **Yes/no is a boolean in code.** Only `backend/platform/sheets/cell.js`
  reads or writes the stored strings `'1'` and `'0'`: a row mapper calls
  `Cell.readFlag(cell, whenAbsent)` and `Cell.writeFlag(value, falseCell)`.
  `cell.js` is the one file under `flags.exclude` in
  `scripts/checks/config.json`.
- **No meaning-free names.** `FIVE = 5` names nothing; `MAX_TEAM_SIZE = 5`
  does.

Numbers need no name when the meaning is the number itself: 0, 1, 2, 10
(base ten), 24 and 60 (hours and minutes), and their negatives. Tests are
exempt: an expected value is data.

## How it is checked

| Where the number is | Check |
|---|---|
| an argument, an operand, an array element, a comparison | Biome `style/noMagicNumbers` |
| the initial value of a variable, a property or a default parameter, which Biome skips | `check-numbers.js`: it passes only under a CONSTANT_CASE variable, property, or constant object around it |

A number that must stay as written, such as a length fixed by a standard,
is silenced on its own line with the reason, and both checks honour it:

```js
// biome-ignore lint/style/noMagicNumbers: SHA-256 gives 32 bytes
```

## Where the constants live today

| Owner | Holds |
|---|---|
| `domain/enums.js` | `FormType`, `FormStatus`, `ReviewStatus`, `ListKind` |
| `backend/platform/config/constants.js` | The app name, the registry tab names, the script property names (`PROPS`) and the cache keys (`CACHE`) |
| `backend/platform/config/access.js` | `Access`, who may call an action |
| each `*.repository.js` | The column list of its tab (`FORM_COLS`, `RESPONSE_COLS`, `CLIENT_COLS_`, `TRANSFER_COLS`, `REQUEST_COLS_`) |
| `responses.repository.js` | `SUBMISSION_STATUSES`, the reference prefix of each form type |
| `lists.repository.js`, `forms.service.js`, `forms.public.js` | The kind and name of each built-in list, the form fields a patch may change, the ones the public may read |
| `auth.service.js` | `ADMIN_MAX_FAILS`, `ADMIN_LOCK_SECONDS` |
| `clients.access.js` | `CLIENT_KEY_TRIES_` |
| `downloads.jobs.js` | The size, time and file limits of a download job |
| `keys.controller.js`, `forms.questions.js`, `sheet-views.*.js`, `workbook.js`, `sheet-style.js` | The limits and sizes of their own feature |
| `domain/rules/text.js` | The Arabic letter and digit tables, the lengths of a name, an English title and an email address |
| `domain/rules/phone.js`, `codes.js`, `drive-link.js` | The Egyptian country code and number lengths, the digits of a student code, the Drive hosts and link kinds, the parts of a folder name |
| `domain/rules/slots.js` | Week day and month names, the minutes of an hour and the hours of a clock face |
| `domain/rules/team-size.js` | `SIZE_ALERT_LEVELS`, the biggest team when a form does not say, the smallest number a warning can ask for |
| `domain/rules/submission.js` | The longest answer of a short and of a long text field |
| `domain/form-metadata/*.js` | The longest subject code, how many academic years are offered ahead and back |
| `web/js/ui/icons.js`, `dialogs.js`, `theme-button.js` | The icon paths, their default size and stroke, the icons a form may use, how long a toast stays |
| `web/js/i18n/i18n.js` | The storage key of the chosen language |
| `web/js/app/fresh.js`, `api.js`, `theme.js` | How often an open page checks its version and the shortest gap between checks, the storage keys of the theme, the admin PIN and the tried version |
| `web/js/form/ticket/*.js` | The colours of the ticket picture, the place and size of each of its shapes (`CALENDAR`, `RING`, `WOOD`, `RIM`, `HAND`, `SLOT`), the degrees of the dial (`DIAL`), the scale and torn edges of the saved image |
| `web/js/teams/size-alerts.view.js` | The name of each warning level and the sizes of its icons |
| `web/js/admin/settings/*.view.js`, `web/js/admin/questions/*.js` | The defaults and bounds of the settings: the team size (`TEAM_SIZE`), the teammates of a booking (`TEAMMATES`), the days a new edit key works (`KEY_DAYS`), the name parts (`NAME_PARTS`), the shape of a new question or page id (`ID`), and the questions that are always asked or fixed to their page |
| `web/js/admin/people/link-end.view.js` | The periods a new link can work for (`LINK_PERIODS`) |
| `web/js/admin/responses/*.js` | The sizes of the link and leader icons of a team, where the key rows go in Details (`KEY_ROWS_AT`), how long the address of a saved CSV file or zip part is kept (`REVOKE_AFTER_MS`, `KEEP_URL_MS`), the bytes of a KB and an MB |
| `web/js/admin/settings/timetable*.js` | The default general hours, the bounds of the bookings per slot and of the minutes of a slot and its break |
| `web/js/*.js` | Each page module's own labels, choices and browser storage keys (`fp_*`) at the top of its wrapper |
| `web/js/config.js` | The backend URL, written by the deploy workflow |

Known gaps, counted in the check baseline until they are fixed:

- Month names are declared in both `domain/rules/slots.js` and
  `web/js/admin/settings/timetable-calendar.view.js`.
