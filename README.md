<div align="center">

# Forms Platform

**Team registration, task submission, time-slot booking and WhatsApp group sign-up for university courses, run from one dashboard, for free.**

[![Test and deploy](https://github.com/moyeh04/forms-platform/actions/workflows/pages.yml/badge.svg)](https://github.com/moyeh04/forms-platform/actions/workflows/pages.yml)
[![Visits](https://hits.sh/github.com/moyeh04/forms-platform.svg?style=flat-square&label=visits&color=3F6B66&labelColor=2F2418)](https://hits.sh/github.com/moyeh04/forms-platform/)

![JavaScript](https://img.shields.io/badge/JavaScript-plain%2C_no_framework-9A3328?style=flat-square&logo=javascript&logoColor=F7DF1E&labelColor=2F2418)
![HTML5](https://img.shields.io/badge/HTML5-pages-9A3328?style=flat-square&logo=html5&logoColor=E34F26&labelColor=2F2418)
![CSS3](https://img.shields.io/badge/CSS3-light_%26_dark-9A3328?style=flat-square&logo=css3&logoColor=1572B6&labelColor=2F2418)
![Google Apps Script](https://img.shields.io/badge/Apps_Script-backend-3F6B66?style=flat-square&logo=googleappsscript&logoColor=4285F4&labelColor=2F2418)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-data-3F6B66?style=flat-square&logo=googlesheets&logoColor=34A853&labelColor=2F2418)
![Google Drive](https://img.shields.io/badge/Google_Drive-files-3F6B66?style=flat-square&logo=googledrive&logoColor=FBBC04&labelColor=2F2418)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-hosting-7E5E1B?style=flat-square&logo=githubpages&logoColor=white&labelColor=2F2418)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-deploy-7E5E1B?style=flat-square&logo=githubactions&logoColor=2088FF&labelColor=2F2418)
![Node.js](https://img.shields.io/badge/Node.js_22-tests_%26_build-7E5E1B?style=flat-square&logo=nodedotjs&logoColor=5FA04E&labelColor=2F2418)

<img src="docs/media/hero.svg" alt="Chat messages, a sheet of duplicate codes and a lost file go into the platform; out come a sheet of teams, an edit key, an Excel list and a zip of every file." width="100%">

</div>

## What it is for

A course with a few hundred students needs teams, project titles, task files and discussion
times. Done through chat groups and shared sheets, that means duplicate codes, half-filled
rows, files nobody can open, and an afternoon of copying. This platform replaces that with
one link per form.

| The problem | What the platform does |
|---|---|
| Teams are formed in chat and typed into a shared sheet by hand | Each form has its own link and its own Google Sheet. Student codes, names, team sizes, majors and sections are checked in the browser and again on the server, by the same rules file |
| A student needs to change something after sending | A 5-digit edit key, shown once and emailed, opens the registration to change or cancel it. It expires, and the admin can read, reset or extend it |
| Discussion times are agreed by message | A timetable of slots, one team per slot. A team can book with the key of its registration, so it only picks the time |
| Task files arrive as links of every kind | A task form takes one Drive link per team and locks at its deadline. **Download all** packs every file into zips with a `Teams.xlsx` list linked to each copy |
| Instructors ask for the list again and again | A private read-only link per instructor, with an optional access key, an end date and hidden columns, ready to print |
| Joining the course WhatsApp groups | A WhatsApp form matches pasted join requests to registrations by phone number |
| Servers cost money and need care | Nothing to rent: the pages are static on GitHub Pages and the backend runs inside the owner's Google account |

## Who uses it

| Person | Page | What they do |
|---|---|---|
| Student | `index.html?f=<form>` | Fills the form in English or Arabic (right to left), on a phone or a computer, and keeps a ticket with the edit key |
| Admin | The dashboard, behind a PIN | Creates and duplicates forms, sets the questions, lists and timetable, reads the responses, prints, exports, downloads all files |
| Instructor | `viewer.html?t=<link>` | Reads the teams or bookings of the forms shared with them, by day or all, and prints them |

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Pages | HTML, CSS and plain JavaScript, no framework and no build step | Small and fast on a phone; the files are served as they are written |
| Rules | `domain/rules/`, loaded by the browser, the backend and the tests | One copy of every check, so the page and the server can never disagree |
| Backend | Google Apps Script web app, bundled into one `Code.gs` by a Node script | Runs as the owner, free, with Sheets, Drive, Mail and a cache built in |
| Data | Google Sheets (a registry plus one spreadsheet per form) and Google Drive | The owner can open, sort and print the data without the platform |
| Excel | Office Open XML written by hand in `backend/platform/xlsx/` | Real `.xlsx` files with merged cells, tints and links, with no library |
| Hosting | GitHub Pages, deployed by GitHub Actions; the backend is pushed with `clasp` | A push to `master` tests and deploys both halves |
| Tests | `node:test`, jsdom and an in-memory copy of the Apps Script services; `actionlint` | The tests run the real backend and pages with no Google account |
| Look | IM Fell English, Amiri and Special Elite, a paper palette in light and dark | Readable in both languages, meeting WCAG 2.1 AA contrast |

## How it fits together

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46}
}}%%
flowchart LR
    student(["Student"]) --> idx["index.html<br/>?f=form"]
    admin(["Admin"]) --> adm["Dashboard<br/>PIN"]
    teacher(["Instructor"]) --> vwr["viewer.html<br/>?t=private-link"]

    subgraph pages["GitHub Pages: static files, free"]
        idx
        adm
        vwr
    end

    subgraph google["Google account: runs as the owner"]
        gas["Apps Script web app<br/>one backend folder"]
        sheets[("Google Sheets<br/>one sheet per form")]
        drive[("Drive<br/>PDFs, zips and form files")]
    end

    idx -- "POST JSON" --> gas
    adm -- "POST JSON + PIN" --> gas
    vwr -- "POST JSON + token" --> gas
    gas --> sheets
    gas --> drive
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    class sheets,drive cDb
    class student,admin,teacher cActor
```

## Quick start

```
npm install          # once, installs the browser test library, Biome and the git hooks
npm run dev          # local preview on http://localhost:8080 (PIN 4321), in memory, no Google needed
npm run check        # Biome, line width, JSDoc, constants and structure checks
npm test             # rules, backend, form page, dashboard, instructor page, deployment
npm run build        # writes dist/Code.gs and dist/appsscript.json for clasp
npm run setup        # first deployment: creates the sheet, pushes the backend, creates the web app, configures GitHub
```

To put it online, follow [docs/operations/DEPLOY.md](docs/operations/DEPLOY.md). After that, a push to `master`
runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml): the tests, then the Apps
Script deployment and the configured website.

## Project layout

| Path | Holds |
|---|---|
| `web/` | The website: the student form, the dashboard and the instructor page, with their scripts, styles and pictures |
| `domain/` | The validation rules and form metadata shared by the pages, the backend and the tests |
| `backend/` | The Apps Script modules, joined into `dist/Code.gs` by `npm run build` |
| `scripts/` | The bundler and the site build (`build/`), the local preview (`dev/`), the first-deployment setup (`deploy/`), and the checks (`checks/`) |
| `tests/` | The automated tests and the in-memory copy of Google's services |
| `docs/` | Architecture, data model, security, testing and deployment |

Every file is described in [docs/architecture/FILE-STRUCTURE.md](docs/architecture/FILE-STRUCTURE.md).

## Documentation

| Read | To learn |
|---|---|
| [REQUIREMENTS.md](docs/product/REQUIREMENTS.md) | Everything the platform was asked to do, and where each item stands |
| [docs/README.md](docs/README.md) | The index of the documentation and how to read its diagrams |
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | What runs where, how requests travel, every module |
| [WORKAROUNDS.md](docs/architecture/WORKAROUNDS.md) | The 24 solutions that make free hosting enough, and their trade-offs |
| [DEPLOY.md](docs/operations/DEPLOY.md) | Click-by-click setup and the first-run checklist |
| [COMMIT_CONVENTION.md](docs/process/COMMIT_CONVENTION.md) | How commits and branches are written |

Generated files (`dist/`, `_site/`, `node_modules/`) are not committed.
