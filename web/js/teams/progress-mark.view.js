/**
 * The mark of one team on one milestone, drawn the same way on the
 * dashboard and on the instructor page: the box that opens from a cell,
 * with the three states (a pick saves at once) and the two notes (Save note
 * appears only after a change), and the queue that saves the marks of one
 * cell one after the other. Each page passes its own `save`.
 */
(function (App) {
  'use strict';

  var ui = App.ui;
  var h = ui.h;
  App.progress = App.progress || {};
  var P = App.progress;

  /** The states in order, with their words. */
  P.STATES = [
    [ProgressState.NOT_YET, 'Not yet'],
    [ProgressState.SUBMITTED, 'Submitted'],
    [ProgressState.DISCUSSED, 'Discussed']
  ];

  /** The note fields of a mark: its key, the change field and the label. */
  var NOTES = [
    ['t', 'teamNote', 'Note for the team'],
    ['p', 'privateNote', 'Private note']
  ];

  /**
   * Gives the word of a state.
   *
   * @param {string} s The state.
   * @return {string} The word.
   */
  P.word = function (s) {
    return P.STATES.filter(function (x) {
      return x[0] === s;
    })[0][1];
  };

  /**
   * Gives a date as "14 Oct".
   *
   * @param {string} iso The time, as ISO text.
   * @return {string} The day and month, or ''.
   */
  P.day = function (iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  };

  /**
   * Saves a change to one cell after the changes before it. The page sees
   * the change at once; a refused change puts the mark back, and a mark
   * changed by someone else meanwhile shows theirs.
   *
   * @param {!Object} b The board: `save`, `queue`, `paint()`.
   * @param {!Object} team The team: `id` and `progress`, changed in place.
   * @param {string} id The milestone.
   * @param {!Object} change `state`, `teamNote` or `privateNote`.
   * @return {!Promise<string>} '' once saved, or the reason it was not.
   */
  P.change = function (b, team, id, change) {
    var key = team.id + ' ' + id;
    var before = Object.assign({}, team.progress);
    team.progress = Rules.applyMark(team.progress, id, change, {
      at: Rules.markOf(team.progress, id).at,
      by: ''
    });
    b.paint();

    /**
     * Sends the change once the changes before it are done.
     *
     * @return {!Promise<string>} '' once saved, or the reason it was not.
     */
    function run() {
      return b
        .save(team, id, change, Rules.markOf(before, id).at)
        .then(function (progress) {
          team.progress = progress;
          return '';
        })
        .catch(function (e) {
          team.progress = e?.details?.progress || before;
          return e?.message || 'Not saved.';
        })
        .then(function (why) {
          b.paint();
          return why;
        });
    }

    b.queue[key] = (b.queue[key] || Promise.resolve()).then(run);
    return b.queue[key];
  };

  /**
   * Draws the three states as one radio group; a pick saves at once.
   *
   * @param {!Object} m The box.
   * @return {!Element} The group.
   */
  function stateGroup(m) {
    var now = Rules.markOf(m.team.progress, m.id).s;
    return h(
      'div',
      { class: 'progress-states', role: 'radiogroup', 'aria-label': 'State' },
      P.STATES.map(function (x) {
        return h(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'toggle-chip state-' + x[0],
            name: 'state-' + x[0],
            'aria-checked': now === x[0] ? 'true' : 'false',
            disabled: !m.b.canMark,
            onclick: function () {
              P.change(m.b, m.team, m.id, { state: x[0] }).then(m.said);
              m.paint();
            }
          },
          x[1]
        );
      })
    );
  }

  /**
   * Draws a note field, and Save note while it differs from the saved
   * note. A refused note stays in its field with the reason.
   *
   * @param {!Object} m The box.
   * @param {!Array<string>} n The note: its key, change field and label.
   * @return {!Element} The field.
   */
  function noteField(m, n) {
    var saved = Rules.markOf(m.team.progress, m.id)[n[0]];
    var save = h(
      'button',
      { type: 'button', class: 'btn btn-quiet sm', name: 'save-' + n[1] },
      'Save note'
    );
    var area = h('textarea', {
      class: 'textarea',
      rows: '3',
      name: n[1],
      maxlength: String(Rules.PROGRESS_NOTE_MAX),
      dir: 'auto',
      oninput: function () {
        save.hidden = area.value.trim() === saved;
      }
    });
    area.value = saved;
    save.hidden = true;
    /** Saves the note; a refused one stays in its field. */
    save.onclick = function () {
      var change = {};
      change[n[1]] = area.value;
      P.change(m.b, m.team, m.id, change).then(function (why) {
        m.said(why);
        if (!why) save.hidden = true;
      });
    };
    return h(
      'label',
      { class: 'field-row' },
      h('span', { class: 'label' }, n[2]),
      area,
      save
    );
  }

  /**
   * Draws a saved note as text, for a link that cannot mark.
   *
   * @param {!Object} m The box.
   * @param {!Array<string>} n The note.
   * @return {?Element} The note, or null when it is empty.
   */
  function noteText(m, n) {
    var text = Rules.markOf(m.team.progress, m.id)[n[0]];
    if (!text) return null;
    return h(
      'div',
      { class: 'field-row' },
      h('span', { class: 'label' }, n[2]),
      h('p', { class: 'progress-note', dir: 'auto' }, text)
    );
  }

  /**
   * Draws the inside of the box again: the states, the notes, when the
   * state last changed and the reason of a refused save.
   *
   * @param {!Object} m The box.
   */
  function paintBox(m) {
    var mark = Rules.markOf(m.team.progress, m.id);
    ui.clear(m.body);
    m.body.appendChild(stateGroup(m));
    if (mark.at) {
      m.body.appendChild(
        h(
          'p',
          { class: 'muted-note' },
          P.word(mark.s) + ' on ' + P.day(mark.at)
        )
      );
    }
    NOTES.forEach(function (n) {
      var node = m.b.canMark ? noteField(m, n) : noteText(m, n);
      if (node) m.body.appendChild(node);
    });
    m.body.appendChild(m.why);
  }

  /**
   * Shows the reason a save was refused, or clears it, and draws the box
   * again while it is open.
   *
   * @param {!Object} m The box.
   * @param {string} why The reason, or ''.
   */
  function said(m, why) {
    m.why.textContent = why;
    m.why.hidden = !why;
    if (m.body.isConnected) m.paint();
  }

  /**
   * Opens the box of one team on one milestone. Escape, a click outside
   * it or Done closes it.
   *
   * @param {!Object} b The board.
   * @param {!Object} team The team.
   * @param {!Object} milestone The milestone.
   */
  P.open = function (b, team, milestone) {
    var m = {
      b: b,
      team: team,
      id: milestone.id,
      body: h('div'),
      why: h('p', { class: 'error', role: 'alert', hidden: true })
    };
    m.paint = paintBox.bind(null, m);
    m.said = said.bind(null, m);
    var title = 'Team ' + team.number + ' · ' + milestone.label.en;
    var overlay;

    /** Closes the box. */
    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }

    /**
     * Closes the box on Escape.
     *
     * @param {!KeyboardEvent} e The key pressed.
     */
    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    overlay = h(
      'div',
      {
        class: 'overlay',
        onclick: function (e) {
          if (e.target === overlay) close();
        }
      },
      h(
        'div',
        {
          class: 'dialog mark-box',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': title
        },
        h('h2', { class: 'dialog-title' }, title),
        m.body,
        h(
          'div',
          { class: 'dialog-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-primary',
              name: 'mark-done',
              onclick: close
            },
            'Done'
          )
        )
      )
    );
    m.paint();
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    var first = overlay.querySelector('[aria-checked="true"]');
    if (first?.focus) first.focus();
  };
})(window.App);
