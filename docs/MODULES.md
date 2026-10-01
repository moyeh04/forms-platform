# How the project is organised

## Website (static files, no build step)

| File | What it is |
|---|---|
| `index.html` | The page students use. Shows any form from its saved definition (`?f=name`). |
| `admin.html` | The admin dashboard (PIN). |
| `viewer.html` | The read-only instructor and client page (`?t=private-token`). |
| `assets/css/theme.css` | Colors, fonts, and the type scale as variables. Change the look here. |
| `assets/css/app.css` | Components of the student page. |
| `assets/css/admin.css` | Dashboard and instructor layout, including the tinted team blocks. |
| `assets/js/config.js` | **The one file you edit:** the web app address. |
| `assets/js/api.js` | Sends requests to the backend as plain-text JSON (avoids browser CORS checks). |
| `assets/js/form.js`, `ticket.js`, `i18n.js` | The student page, the success ticket, English and Arabic text. |
| `assets/js/admin*.js` | Dashboard: core and forms list, settings, responses and matching, clients and lists. |
| `assets/js/viewer.js` | The instructor page. |
| `shared/rules.js` | Validation and normalization rules (Arabic names, phones, codes, Drive links, team size, slots). Used by the browser, the backend, and the tests, so all three always agree. |

## Backend (`backend/`, becomes one `Code.gs`)

| File | What it does |
|---|---|
| `Code.gs` | Entry point. Routes each request to its handler. |
| `Config.gs` | Constants and small helpers. |
| `Auth.gs` | Admin PIN (salted hash, lockout). |
| `Registry.gs` | The registry sheet: forms, lists, clients; setup. |
| `Templates.gs` | The four form types and the default lists, all as data. |
| `FormsApi.gs` | Create, update, and duplicate forms; the public form definition. |
| `Responses.gs` | Reading and writing rows, edit keys, limits, Drive checks, emails. |
| `Submissions.gs` | Student submit, lookup, update, cancel; admin edits and key reset. |
| `Slots.gs` | Reservation timetable checks and availability. |
| `Views.gs` | Tinted block views inside each form's Google Sheet. |
| `Print.gs` | Print tabs and PDF export. |
| `Menu.gs` | The "Forms Platform" menu in the registry sheet. |
| `Matching.gs` | WhatsApp request matching. |
| `Clients.gs`, `Viewer.gs` | Private instructor links and what they can see. |
| `Export.gs` | Team data for the Excel export script. |

`npm run build` joins `shared/rules.js` and every backend file into `dist/Code.gs`.

## Tools and tests

| Path | What it is |
|---|---|
| `scripts/bundle-backend.js` | The bundler. |
| `scripts/download_tasks.py` | Downloads task files and builds `Tasks.xlsx`. |
| `tests/harness/appsscript-mock.js` | An in-memory Sheets, Drive, Mail, Cache, and clock, so the real backend code runs in tests. |
| `tests/harness/dom.js` | Opens the real pages in jsdom wired to that backend. |
| `tests/*.test.js` | 145 tests. |
| `tests/test_download_tasks.py` | 20 tests for the export, with a local server in place of Google. |

## Data model in one paragraph

The **Forms Registry** sheet has one row per form (its whole definition as JSON),
the shared lists, and the instructor links (only a hash of each link's secret is
stored). Each form owns a **separate spreadsheet** with a Responses tab (the raw
data), and the tinted views built from it. A form definition is plain data:
questions, steps, rules (including the team size range), slots, review steps. The
engine never hard-codes a question, which is why new forms need no code.
