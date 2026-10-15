/**
 * Admin responses. Every team, day, or registration is its own block with a
 * tint and a heavy border, matching the Google Sheet, so names line up with
 * their project, task, or slot at a glance. The parts of the page share one
 * object, `p`: the form, its submissions and transfers, the filters, and
 * what draws the page again.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var Rules = window.Rules;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Draws one number of the stats line.
   *
   * @param {number} n The number.
   * @param {string} label What it counts.
   * @param {!Object=} attrs More attributes.
   * @return {!Element} The stat.
   */
  function stat(n, label, attrs) {
    return h(
      'span',
      Object.assign({ class: 'stat' }, attrs),
      h('b', null, String(n)),
      label
    );
  }

  /**
   * Draws the stats line: the total, the people, and each status in use.
   *
   * @param {!Object} p The page.
   */
  function paintStats(p) {
    ui.clear(p.stats);
    p.stats.appendChild(stat(p.all.length, 'Total'));
    p.stats.appendChild(
      stat(Rules.countPeople(p.form, p.all), 'People', {
        title: 'Leaders and members. A student code is counted once.',
        dataset: { stat: 'people' }
      })
    );
    A.SUB_STATUSES.forEach(function (st) {
      var n = p.all.filter(function (s) {
        return s.status === st;
      }).length;
      if (n) p.stats.appendChild(stat(n, A.SUB_LABEL[st]));
    });
  }

  /**
   * Draws the small teams the form warns about.
   *
   * @param {!Object} p The page.
   * @return {?Element} The warning, or null when there is none.
   */
  function warned(p) {
    var alerts = Rules.sizeAlerts(p.form);
    return App.sizeAlerts.summary(
      Rules.sizeAlertLevels(alerts),
      p.all.map(function (s) {
        return {
          label: 'Team ' + s.number,
          alert: Rules.sizeAlertOf(
            alerts,
            Rules.membersOf(p.form, s.data).length
          )
        };
      })
    );
  }

  /**
   * Draws the line of the teams under the minimum size.
   *
   * @param {!Array<!Object>} small The teams under the minimum.
   * @param {number} min The minimum.
   * @return {!Element} The line.
   */
  function underMinLine(small, min) {
    return h(
      'p',
      { class: 'request-warn', name: 'under-min' },
      (small.length === 1 ? 'One team is' : small.length + ' teams are') +
        ' under the minimum of ' +
        min +
        ': ' +
        small
          .map(function (s) {
            return s.ref;
          })
          .join(', ') +
        '.'
    );
  }

  /**
   * Draws what waits for the admin: members asked for by another team,
   * teams under the minimum size, and the small teams the form warns
   * about.
   *
   * @param {!Object} p The page.
   * @return {?Element} The section, or null when nothing waits.
   */
  function needsYou(p) {
    var sizeField = Rules.fieldByRole(p.form, 'team_size');
    var small = R.underMin(p.form, p.all, sizeField);
    var warning = sizeField ? warned(p) : null;
    if (!p.transfers.length && !small.length && !warning) return null;
    return h(
      'section',
      { class: 'requests', 'aria-label': 'Needs you' },
      R.transferRows(p),
      small.length
        ? underMinLine(small, Rules.teamSizeRange(p.form).min)
        : null,
      warning
    );
  }

  /**
   * Draws a tab of a form with WhatsApp matching.
   *
   * @param {!Object} p The page.
   * @param {string} tab matching or list.
   * @param {string} text What it says.
   * @return {!Element} The tab.
   */
  function tabButton(p, tab, text) {
    var on = p.state.tab === tab;
    return h(
      'button',
      {
        type: 'button',
        class: 'btn sm ' + (on ? 'btn-primary' : 'btn-quiet'),
        role: 'tab',
        'aria-selected': on ? 'true' : 'false',
        name: 'tab-' + tab,
        onclick: function () {
          p.state.tab = tab;
          p.paint();
        }
      },
      text
    );
  }

  /**
   * Draws the progress board of the teams shown. The admin marks every
   * team.
   *
   * @param {!Object} p The page.
   * @param {!Array<!Object>} rows The teams shown.
   * @return {!Element} The board.
   */
  function progressBoard(p, rows) {
    return App.progress.board({
      milestones: Rules.milestonesOf(p.form),
      teams: rows.slice().sort(function (a, b) {
        return a.number - b.number;
      }),
      canMark: true,
      view: p.boardView,
      save: function (team, id, change, baseAt) {
        return A.call(
          'admin.progress.mark',
          Object.assign(
            {
              slug: p.form.slug,
              submissionId: team.id,
              milestone: id,
              baseAt: baseAt
            },
            change
          )
        ).then(function (out) {
          return out.progress;
        });
      }
    });
  }

  /**
   * Draws the submissions shown, the way the form type lists them.
   *
   * @param {!Object} p The page.
   * @return {!Element} The list, or why it is empty.
   */
  function list(p) {
    var rows = p.filtered();
    if (!rows.length) {
      return h(
        'div',
        { class: 'empty' },
        p.all.length
          ? 'Nothing matches that search.'
          : 'No submissions yet. Share the form link to start collecting.'
      );
    }
    if (p.form.type === FormType.RESERVATION) {
      return R.bookings(p.form, rows, p.reload);
    }
    if (p.form.type === FormType.WHATSAPP_REGISTRATION) {
      return R.registrations(p.form, rows, p.reload);
    }
    if (p.state.view === 'progress' && Rules.progressOn(p.form)) {
      return progressBoard(p, rows);
    }
    return R.teams(p.form, rows, p.reload);
  }

  /**
   * Draws the content again: the matching tab, or what needs the admin
   * and the list.
   *
   * @param {!Object} p The page.
   * @return {*} Nothing that is used.
   */
  function paint(p) {
    var content = p.content;
    ui.clear(content);
    if (R.hasMatching(p.form)) {
      content.appendChild(
        h(
          'div',
          {
            class: 'actions',
            style: { marginBottom: '14px' },
            role: 'tablist'
          },
          tabButton(p, 'matching', 'Match WhatsApp requests'),
          tabButton(p, 'list', 'All registrations')
        )
      );
      if (p.state.tab === 'matching') {
        p.stats.hidden = true;
        return R.matching(p.form, content);
      }
    }
    p.stats.hidden = false;
    var needs = needsYou(p);
    if (needs) content.appendChild(needs);
    content.appendChild(list(p));
  }

  /** Loads the page again. */
  function reload() {
    A.render();
  }

  /**
   * Draws the Responses page of a form.
   *
   * @param {!Element} mount Where the page goes.
   * @param {string} slug The form.
   * @return {!Promise} Settles once it is drawn.
   */
  A.views.responses = async function (mount, slug) {
    var both = await Promise.all([
      A.call('admin.forms.get', { id: slug }),
      A.call('admin.submissions', { slug: slug })
    ]);
    var p = {
      form: both[0].form,
      all: both[1].submissions,
      transfers: both[1].transfers || [],
      content: h('div'),
      stats: h('div', { class: 'stats' }),
      boardView: {},
      reload: reload
    };
    p.state = {
      q: '',
      status: 'all',
      tab: R.hasMatching(p.form) ? 'matching' : 'list',
      view: App.progress.savedView(p.form.slug)
    };
    p.paint = paint.bind(null, p);
    p.filtered = R.filtered.bind(null, p.form, p.all, p.state);
    ui.clear(mount);
    mount.appendChild(A.formHead(p.form));
    mount.appendChild(A.formTabs(p.form, 'responses'));
    paintStats(p);
    mount.appendChild(p.stats);
    mount.appendChild(R.toolbar(p));
    mount.appendChild(p.content);
    p.paint();
  };
})(window.App);
