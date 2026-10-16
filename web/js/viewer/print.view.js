/**
 * The printed list of the instructor page. Print and Ctrl+P both print a
 * sheet made for paper, not the screen: a heading with the form, what is
 * shown and when it was printed, then plain tables with every column the
 * link sees, a team or a day kept on one page where it fits. The screen
 * never shows the sheet.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var S = V.state;
  var h = App.ui.h;

  /** The member columns of a team, in the order they are printed. */
  var MEMBER_COLS = [
    ['name', 'Name'],
    ['section', 'Section'],
    ['code', 'Code'],
    ['phone', 'Phone']
  ];

  /** The columns printed in a fixed-width font. */
  var MONO = ['code', 'phone', 'time'];

  /** The word for each review state. */
  var REVIEW_WORD = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected'
  };

  /**
   * Draws a link as a short word, which a saved PDF keeps clickable.
   *
   * @param {string} url The address.
   * @return {?Element} The link, or null when there is none.
   */
  function linkTo(url) {
    return url ? h('a', { href: url }, 'Link') : null;
  }

  /**
   * Draws one printed cell.
   *
   * @param {string} col The column.
   * @param {*} v The value.
   * @return {!Element} The cell.
   */
  function cell(col, v) {
    var text = v === undefined || v === null ? '' : String(v);
    if (col === 'name') {
      return h('td', { class: 'nm' }, h('bdi', { lang: 'ar' }, text));
    }
    if (col === 'link') return h('td', null, linkTo(text));
    return h('td', { class: MONO.indexOf(col) !== -1 ? 'mono' : null }, text);
  }

  /**
   * Draws the head row of a printed table.
   *
   * @param {!Array<!Array<string>>} cols Each column: its id and label.
   * @return {!Element} The head.
   */
  function head(cols) {
    return h(
      'thead',
      null,
      h(
        'tr',
        null,
        cols.map(function (c) {
          return h('th', { scope: 'col' }, c[1]);
        })
      )
    );
  }

  /**
   * Gives the columns of the data as [id, label] pairs.
   *
   * @param {!Object} d The data of the form.
   * @return {!Array<!Array<string>>} The columns.
   */
  function columnsOf(d) {
    return d.columns.map(function (c) {
      return [c.id, c.label];
    });
  }

  /**
   * Draws the teams: one block per team, its number and project in the
   * first column and a row per member.
   *
   * @param {!Object} d The data of the form.
   * @return {!Element} The table.
   */
  function teamTable(d) {
    var ids = d.columns.map(function (c) {
      return c.id;
    });
    var cols = MEMBER_COLS.filter(function (c) {
      return ids.indexOf(c[0]) !== -1;
    });
    var bodies = shown(d).map(function (g) {
      return h(
        'tbody',
        { class: 'keep' },
        g.members.map(function (m, i) {
          return h(
            'tr',
            { class: i ? null : 'first' },
            i ? null : teamCell(d, g),
            h('td', { class: 'num' }, String(i + 1)),
            cols.map(function (c) {
              var td = cell(c[0], m[c[0]]);
              if (c[0] === 'name' && m.leader) {
                td.appendChild(h('span', { class: 'lead' }, '★ Leader'));
              }
              return td;
            })
          );
        })
      );
    });
    return h(
      'table',
      { class: 'print-table' },
      head(
        [
          ['team', 'Team'],
          ['num', '#']
        ].concat(cols)
      ),
      bodies
    );
  }

  /**
   * Draws the first cell of a team: its number, its project or task, its
   * link and how far it came, as far as the link shows them.
   *
   * @param {!Object} d The data of the form.
   * @param {!Object} g The team.
   * @return {!Element} The cell, across the rows of its members.
   */
  function teamCell(d, g) {
    return h(
      'th',
      { scope: 'rowgroup', rowspan: String(g.members.length || 1) },
      h('strong', null, 'Team ' + g.number),
      g.title ? h('div', { dir: 'auto' }, g.title) : null,
      g.link ? h('div', null, linkTo(g.link)) : null,
      d.milestones
        ? h(
            'div',
            { class: 'note' },
            App.progress.countText(d.milestones, g.progress)
          )
        : null
    );
  }

  /**
   * Draws the bookings, a table per day.
   *
   * @param {!Object} d The data of the form.
   * @return {!Array<!Element>} The days.
   */
  function bookingTables(d) {
    var cols = columnsOf(d);
    var days = [];
    shown(d).forEach(function (r) {
      var day = days.filter(function (x) {
        return x.id === r.dayId;
      })[0];
      if (!day) {
        day = { id: r.dayId, label: r.dayLabel, date: r.date, rows: [] };
        days.push(day);
      }
      day.rows.push(r);
    });
    return days.map(function (day) {
      return h(
        'section',
        { class: 'keep' },
        h(
          'h2',
          null,
          h('span', null, day.label + (day.date ? ' (' + day.date + ')' : '')),
          h('span', { class: 'note' }, day.rows.length + ' booked')
        ),
        rowTable(cols, day.rows, null)
      );
    });
  }

  /**
   * Draws rows as one table.
   *
   * @param {!Array<!Array<string>>} cols The columns.
   * @param {!Array<!Object>} rows The rows.
   * @param {?function(!Object): !Array<!Element>} review The review of a
   *     row, or null when there is no review column.
   * @return {!Element} The table.
   */
  function rowTable(cols, rows, review) {
    return h(
      'table',
      { class: 'print-table' },
      head(cols),
      h(
        'tbody',
        null,
        rows.map(function (r) {
          return h(
            'tr',
            null,
            cols.map(function (c) {
              return c[0] === 'review' && review
                ? h('td', { class: 'review' }, review(r))
                : cell(c[0], r[c[0]]);
            })
          );
        })
      )
    );
  }

  /**
   * Writes the review of each step of a registration, a line each.
   *
   * @param {!Object} d The data of the form.
   * @param {!Object} r The registration.
   * @return {!Array<!Element>} "Step: Approved", one per step.
   */
  function reviewLines(d, r) {
    return d.steps.map(function (st) {
      var s = r.review?.[st.id] || 'pending';
      return h(
        'div',
        null,
        st.label.en + ': ',
        h('span', { class: 'is-' + s }, REVIEW_WORD[s] || s)
      );
    });
  }

  /**
   * Gives the teams or rows that hold the search.
   *
   * @param {!Object} d The data of the form.
   * @return {!Array<!Object>} What is printed.
   */
  function shown(d) {
    return (d.kind === 'team' ? d.groups : d.rows).filter(V.matches);
  }

  /**
   * Counts what is printed, in words.
   *
   * @param {!Object} d The data of the form.
   * @return {string} "3 teams", "12 bookings" or "40 registrations".
   */
  function countText(d) {
    var n = shown(d).length;
    var word = { team: 'team', reservation: 'booking' }[d.kind];
    return n + ' ' + (word || 'registration') + (n === 1 ? '' : 's');
  }

  /**
   * Says which bookings are printed: today, one day, or all of them.
   *
   * @param {!Object} d The data of the form.
   * @return {string} The view, or '' for other forms.
   */
  function viewText(d) {
    if (d.kind !== 'reservation') return '';
    if (S.mode === 'today') return 'Today';
    var day = (d.days || []).filter(function (x) {
      return x.id === S.dayId;
    })[0];
    return S.mode === 'day' && day ? day.label : 'All days';
  }

  /**
   * Draws the heading of the sheet.
   *
   * @param {!Object} d The data of the form.
   * @return {!Element} The heading.
   */
  function heading(d) {
    var printed = new Date().toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    var facts = FormMetadata.display(d.form)
      .map(function (x) {
        return x.value;
      })
      .concat([viewText(d), countText(d)])
      .filter(Boolean);
    return h(
      'header',
      null,
      h('h1', null, d.form.title),
      h('p', { class: 'facts' }, facts.join(' · ')),
      h(
        'p',
        { class: 'note' },
        'Printed ' +
          printed +
          (S.q.trim() ? ' · only rows with "' + S.q.trim() + '"' : '')
      )
    );
  }

  /**
   * Draws the body of the sheet, by the kind of the form.
   *
   * @param {!Object} d The data of the form.
   * @return {*} The tables.
   */
  function body(d) {
    if (!shown(d).length) return h('p', null, 'Nothing to print.');
    if (d.kind === 'team') return teamTable(d);
    if (d.kind === 'reservation') return bookingTables(d);
    return rowTable(columnsOf(d), shown(d), reviewLines.bind(null, d));
  }

  /**
   * Draws the sheet of the open form again, so a print shows it as it is
   * now. Nothing happens before a form is open.
   */
  V.preparePrint = function () {
    var old = document.querySelector('.print-sheet');
    if (old) old.remove();
    var d = S.data;
    if (!d || S.error || S.askKey) return;
    document.body.appendChild(
      h('div', { class: 'print-sheet' }, heading(d), body(d))
    );
  };

  /** Prints the sheet of the open form. */
  V.print = function () {
    V.preparePrint();
    window.print();
  };

  window.addEventListener('beforeprint', V.preparePrint);
})(window.App);
