/**
 * The progress board of a team form, drawn the same way on the dashboard
 * and on the instructor page. On a wide screen it is a table of teams and
 * milestones; on a phone, one milestone at a time with a line for each
 * team and its three states inline. A cell opens the mark box of
 * progress-mark.view.js. The counts come from Rules; this file only draws.
 */
(function (App) {
  'use strict';

  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;
  App.progress = App.progress || {};
  var P = App.progress;

  /** The size of the note icon in a cell, in pixels. */
  var NOTE_ICON = 12;

  /** Where the tab keeps whether a form shows Teams or Progress. */
  var VIEW_KEY = 'progress-view:';

  /**
   * Reads whether a form showed Teams or Progress last in this tab.
   *
   * @param {string} slug The form.
   * @return {string} 'progress' or 'teams'.
   */
  P.savedView = function (slug) {
    try {
      return window.sessionStorage.getItem(VIEW_KEY + slug) || 'teams';
    } catch (_e) {
      return 'teams';
    }
  };

  /**
   * Draws the Teams | Progress switch; the choice is kept for the tab.
   *
   * @param {string} slug The form.
   * @param {string} view 'teams' or 'progress'.
   * @param {function(string)} pick Shows the view picked.
   * @return {!Element} The switch.
   */
  P.viewSwitch = function (slug, view, pick) {
    return h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'Show' },
      [
        ['teams', 'Teams'],
        ['progress', 'Progress']
      ].map(function (x) {
        return h(
          'button',
          {
            type: 'button',
            class: 'btn sm ' + (view === x[0] ? 'btn-primary' : 'btn-quiet'),
            name: 'view-' + x[0],
            'aria-pressed': view === x[0] ? 'true' : 'false',
            onclick: function () {
              try {
                window.sessionStorage.setItem(VIEW_KEY + slug, x[0]);
              } catch (_e) {
                // The choice lasts until the page is drawn again.
              }
              pick(x[0]);
            }
          },
          x[1]
        );
      })
    );
  };

  /**
   * Makes the form the rules read the counts from.
   *
   * @param {!Array<!Object>} milestones The milestones.
   * @return {!Object} A team registration with those milestones.
   */
  function formOf(milestones) {
    return {
      type: FormType.TEAM_REGISTRATION,
      progress: { milestones: milestones }
    };
  }

  /**
   * Says how many milestones a team has discussed: "3 of 6 discussed".
   *
   * @param {!Array<!Object>} milestones The milestones.
   * @param {?Object} progress The marks of the team.
   * @return {string} The count.
   */
  P.countText = function (milestones, progress) {
    var c = Rules.progressCount(formOf(milestones), progress);
    return c.discussed + ' of ' + c.total + ' discussed';
  };

  /**
   * Counts the teams that discussed a milestone.
   *
   * @param {!Array<!Object>} teams The teams.
   * @param {string} id The milestone.
   * @return {number} How many did.
   */
  function discussedBy(teams, id) {
    return teams.filter(function (t) {
      return Rules.markOf(t.progress, id).s === ProgressState.DISCUSSED;
    }).length;
  }

  /**
   * Describes a cell for a screen reader and its tooltip.
   *
   * @param {!Object} team The team.
   * @param {!Object} m The milestone.
   * @param {!Object} mark The mark.
   * @return {string} The description.
   */
  function cellLabel(team, m, mark) {
    var notes = [mark.t, mark.p].filter(Boolean).join(' / ');
    return (
      'Team ' +
      team.number +
      ', ' +
      m.label.en +
      ': ' +
      P.word(mark.s) +
      (notes ? '. Note: ' + notes : '')
    );
  }

  /**
   * Draws the cell of a team on a milestone: a button when it can be
   * marked or has a note to read, otherwise only its state.
   *
   * @param {!Object} b The board.
   * @param {!Object} team The team.
   * @param {!Object} m The milestone.
   * @return {!Element} The cell.
   */
  function cell(b, team, m) {
    var mark = Rules.markOf(team.progress, m.id);
    var label = cellLabel(team, m, mark);
    var inner = [
      h('span', { class: 'pdot', 'aria-hidden': 'true' }),
      mark.t || mark.p ? icon('note', NOTE_ICON) : null
    ];
    var open = b.canMark || mark.t || mark.p;
    var node = open
      ? h(
          'button',
          {
            type: 'button',
            class: 'pcell is-' + mark.s,
            name: 'cell-' + team.number + '-' + m.id,
            'aria-label': label,
            title: label,
            onclick: function () {
              P.open(b, team, m);
            }
          },
          inner
        )
      : h('span', { class: 'pcell is-' + mark.s, title: label }, inner);
    return h('td', null, node);
  }

  /**
   * Draws the table of every team and milestone.
   *
   * @param {!Object} b The board: `milestones`, `teams`.
   * @return {!Element} The table, in a box that scrolls sideways.
   */
  function table(b) {
    var ms = b.milestones;
    var head = h(
      'tr',
      null,
      h('th', { scope: 'col' }, 'Team'),
      ms.map(function (m) {
        return h(
          'th',
          { scope: 'col' },
          h('span', { dir: 'auto' }, m.label.en),
          h(
            'span',
            { class: 'muted-note' },
            discussedBy(b.teams, m.id) + ' of ' + b.teams.length + ' discussed'
          )
        );
      }),
      h('th', { scope: 'col' }, 'Discussed')
    );
    var rows = b.teams.map(function (t) {
      var c = Rules.progressCount(formOf(ms), t.progress);
      return h(
        'tr',
        { dataset: { team: String(t.number) } },
        h(
          'th',
          { scope: 'row' },
          'Team ' + t.number,
          t.title
            ? h('span', { class: 'muted-note', dir: 'auto' }, t.title)
            : null
        ),
        ms.map(cell.bind(null, b, t)),
        h('td', { class: 'pcount' }, c.discussed + ' of ' + c.total)
      );
    });
    return h(
      'div',
      { class: 'progress-scroll' },
      h(
        'table',
        { class: 'progress-table' },
        h('thead', null, head),
        h('tbody', null, rows)
      )
    );
  }

  /**
   * Gives the milestone the phone view opens on: the first one not yet
   * discussed by every team.
   *
   * @param {!Object} b The board.
   * @return {string} Its id.
   */
  function firstOpen(b) {
    var open = b.milestones.filter(function (m) {
      return discussedBy(b.teams, m.id) < b.teams.length;
    })[0];
    return (open || b.milestones[0]).id;
  }

  /**
   * Draws the line of one team on the milestone picked on a phone: its
   * three states inline (one tap marks) or its state, a note button and
   * the note for the team under it.
   *
   * @param {!Object} b The board.
   * @param {!Object} team The team.
   * @param {!Object} m The milestone.
   * @return {!Element} The line.
   */
  function phoneLine(b, team, m) {
    var mark = Rules.markOf(team.progress, m.id);
    var states = b.canMark
      ? h(
          'span',
          {
            class: 'progress-states',
            role: 'radiogroup',
            'aria-label': 'State'
          },
          P.STATES.map(function (x) {
            return h(
              'button',
              {
                type: 'button',
                role: 'radio',
                class: 'toggle-chip sm state-' + x[0],
                name: 'line-' + team.number + '-' + x[0],
                'aria-checked': mark.s === x[0] ? 'true' : 'false',
                onclick: function () {
                  P.change(b, team, m.id, { state: x[0] });
                }
              },
              x[1]
            );
          })
        )
      : h('span', { class: 'pstate is-' + mark.s }, P.word(mark.s));
    return h(
      'li',
      { class: 'progress-line', dataset: { team: String(team.number) } },
      h(
        'div',
        { class: 'progress-line-head' },
        h('strong', null, 'Team ' + team.number),
        team.title
          ? h('span', { class: 'muted-note', dir: 'auto' }, team.title)
          : null
      ),
      states,
      b.canMark || mark.t || mark.p
        ? h(
            'button',
            {
              type: 'button',
              class: 'icon-btn sm',
              name: 'notes-' + team.number,
              'aria-label': 'Notes of team ' + team.number,
              onclick: function () {
                P.open(b, team, m);
              }
            },
            icon('note', NOTE_ICON)
          )
        : null,
      mark.t ? h('p', { class: 'progress-note', dir: 'auto' }, mark.t) : null
    );
  }

  /**
   * Draws the phone view: a milestone picker and a line for each team.
   *
   * @param {!Object} b The board.
   * @return {!Element} The view.
   */
  function phone(b) {
    var m = b.milestones.filter(function (x) {
      return x.id === b.view.picked;
    })[0];
    if (!m) {
      b.view.picked = firstOpen(b);
      return phone(b);
    }
    var sel = h(
      'select',
      {
        class: 'select',
        name: 'progress-milestone',
        'aria-label': 'Milestone',
        onchange: function (e) {
          b.view.picked = e.target.value;
          b.paint();
        }
      },
      b.milestones.map(function (x) {
        return h(
          'option',
          { value: x.id, selected: x.id === m.id },
          x.label.en
        );
      })
    );
    return h(
      'div',
      { class: 'progress-phone' },
      sel,
      h(
        'ol',
        { class: 'progress-lines' },
        b.teams.map(function (t) {
          return phoneLine(b, t, m);
        })
      )
    );
  }

  /**
   * Draws the board of a team form.
   *
   * @param {!Object} o What it shows: `milestones`, `teams` (each `id`,
   *     `number`, `title`, `progress`), `canMark`, `save(team, id, change,
   *     baseAt)` that resolves with the new marks of the team, and `view`,
   *     an object the page keeps that holds the milestone picked on a phone.
   * @return {!Element} The board; it draws itself again after each mark.
   */
  P.board = function (o) {
    var b = Object.assign({ queue: {}, view: {} }, o);
    var node = h('div', { class: 'progress-board' });
    /** Draws the board again from the marks of its teams. */
    b.paint = function () {
      ui.clear(node);
      if (!b.teams.length) {
        node.appendChild(h('div', { class: 'empty' }, 'No teams to show.'));
        return;
      }
      node.appendChild(table(b));
      node.appendChild(phone(b));
    };
    b.paint();
    return node;
  };
})(window.App);
