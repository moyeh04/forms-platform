# UI and UX rules

The rules every page follows, each with the place that shows it. A change to a
page is checked against this list before it is written, and a rule that a
review adds is written here in the same branch, so it is not lost in a chat.

The pages are the student form (`index.html`), the dashboard (`admin.html`) and
the instructor page (`viewer.html`).

## The rules

| # | Rule | Where to see it |
|---|---|---|
| 1 | **A control is shown only when it can act.** No greyed-out switch, no button that answers "nothing to do" | The save bar exists only while something differs from the saved copy. A question the form cannot work without says "Always asked" where the others have Show and Required. **Add a year group** opens a card only when asked, and its **Add 3C** appears once a year, a letter and one count above 0 are chosen; until then one line says what is missing. A team that already booked gets no Next button; its button is **Change the time** |
| 2 | **A refused input stays in its field, with the reason next to it.** Never a toast for something the person must correct | A wrong PIN stays selected in the login field. A wrong access key stays in the instructor key box. A form with no title keeps the page and marks the title. A status the server refuses puts the saved status back and says why under the header |
| 3 | **A warning is shown where its cause is, before the save, with the count** | The timetable counts the bookings left on a day or time that was removed. The team size panel counts the saved teams a new range leaves outside. Picking another time for a booking names the time it gives up, which anyone can then book. A save says nothing more than "saved" |
| 4 | **One setting, one rule, in every place it appears** | Every tab of a form has the same header: title, tags, status, **Open form**, **Copy link**, **More**. The card of a form and its header share one **More** menu. The card calls the tab **Setup**, as the tab does. One theme button is used by all three pages, before and after signing in |
| 5 | **What is shown beside a title is the saved state** | The status in the header is saved the moment it changes, on every tab. It is not one of the unsaved changes of the Setup page |
| 6 | **Plain words, never an id from the code** | Question types read "Drive link", "Student code", "One choice from a list". Statuses, list kinds and form types have names |
| 7 | **A key is asked for in one place on a screen** | A booking made with a team's key starts with that key. The screen has no second key box; a team that already booked is told its time there, with the way to change it. Its ticket does not show that key again: it draws the day and the time |
| 8 | **Every mode has a way out** | A registration opened with a key has **Close** on its summary. It asks first only when something was changed and not saved |
| 9 | **A hint must not read as an answer** | The phone field hints `01xxxxxxxxx`, not a number that looks filled in |
| 10 | **Maintenance is under More** | **Rebuild sheet**, **Duplicate** and **Delete form** are in the More menu, not among the tools used every day |
| 11 | **Lists are ordered by what matters now** | The forms list is grouped Open, Draft, Closed, Archived, newest first inside a group. A reservation with no days says "No days yet" on its card, and the note leads to the timetable |
| 12 | **Nothing about the university is written in the code** | Majors, levels, bylaws, sections and groups are lists edited under **Lists**. The department letters and the section kinds (TH, T …) are the ones the section lists use; a new one is typed once, in the new year group or on a card, and is a chip from then on because a group uses it |
| 13 | **An action is offered where it makes sense** | The first booking of a form is offered on team and task forms, where there are teams to book. A form that already has bookings keeps them listed |
| 14 | **Sample text is generic** | Placeholders and previews use made-up names (`Task 1`, `001`), never a real course, person or file |
| 15 | **A limit is shown before it is hit, in the look of the site** | Every day and time of a booking says how many places are left before it is picked. A full one is not greyed out: it is a torn ticket, ragged at the top and bottom, cut by a red line and marked **Fully booked** |
| 16 | **A picture keeps its own colours** | The ticket picture is printed on a parchment card in fixed colours, so it looks the same in both themes and in the saved image; only the card is a little darker at night. The ship, the islands and the treasure of the route are drawn the same way; the sea and the sky behind them follow the theme, by day in the light one and by night in the dark one |
| 17 | **A change is one step, never undo and do again** | A booking that may be cancelled may also move to another time, from its own time step; cancelling to book again is never the only way |
| 18 | **The point of a picture reads at phone size** | The thing a picture is about (the chest on the treasure island, the day on the calendar, the hands of the clock) is large and bold enough to read on a phone screenshot at its real size. A drawing is detailed in the style of the others, with outlines, shading and light, not a flat pattern or a bare line icon |
| 19 | **One meaning, one control** | Two settings that mean the same kind of thing are set with the same control and the same checks. The team size and the teammates of a booking are both ranges, so both use `A.sizeRange`: number fields, the numbers students will see, the saved answers a new range leaves outside, and a note for some numbers |
| 20 | **A setting sits where its effect is, not next to what it depends on** | The Questions tab holds what students see and answer; Setup holds how the form behaves and who sees what. The warnings about small teams change only what the admin and instructors see, so they are in Setup, although their numbers depend on the team size in Questions. What one instructor sees is set on that instructor's link, next to whether they may review, not on each form |
| 21 | **A page never reloads over work in progress** | A page that is older than the published site reloads itself only when nothing was typed or chosen and no dialog is open. Otherwise a strip at the top says a newer version is ready and offers **Reload**, in the language of the page, and the visitor decides when |

## Screens

| Check | How |
|---|---|
| Phone and desktop | Every page is read at 390 px and at 1280 px. Nothing scrolls sideways |
| Light and dark | Both themes are looked at, not assumed. Colours come from the tokens in `web/css/theme.css`, and `tests/web/css/theme.test.js` holds every pair the pages use to WCAG 2.1 AA |
| Arabic | The student form is read right to left as well; a name, a code, a phone number or a time keeps its own direction. A time inside an Arabic sentence is wrapped in direction isolates. The ticket picture is the same in both languages, since a clock or a calendar read backwards would be wrong |
| Keyboard and screen reader | A field has a label, an error is tied to its field (`aria-describedby`) and announced (`role="alert"`), the current tab and trail step carry `aria-current`. The digits of a key are read one by one from hidden text; the drawn boxes are hidden from the reader |

`npm run dev` starts a preview with sample data (see
[TESTING.md](../process/TESTING.md)); a change to a page is looked at there in the four
views before it is committed.

## Words

- Say what happens, in the order it happens: "The copy keeps every setting,
  starts as a draft, and gets its own empty Google Sheet."
- A button names its action and its object: **Copy link**, **Add 3L**,
  **Remove TH from 4C**, **Close without saving**.
- A warning ends with what to do: "Widen the range, or ask those teams to
  change the team size."
- No "please", no "successfully", no exclamation marks.
