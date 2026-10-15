/**
 * Admin: download everything a team or task form collected, as zip parts
 * with Teams.xlsx. This window starts the download, shows how far it is,
 * and offers to start again when it stops. The download it shares with
 * its parts is one object, `d`: the form, the body and whether the window
 * is still open.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Draws the button that starts the download.
   *
   * @param {!Object} d The download.
   * @param {string} text What it says.
   * @param {boolean} withIcon True to show the download icon.
   * @return {!Element} The button row.
   */
  function startRow(d, text, withIcon) {
    return h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          name: 'download-start',
          onclick: d.run
        },
        withIcon ? ui.icon('download', A.ICON_SIZE.LINE) : null,
        text
      )
    );
  }

  /**
   * Draws what the download saves, and the Start button.
   *
   * @param {!Object} d The download.
   */
  function intro(d) {
    ui.clear(d.body);
    d.body.appendChild(
      h(
        'p',
        null,
        d.tasks
          ? "Every team's task file is saved, and Teams.xlsx lists the teams" +
              ' with a link from each task to its file. Google Slides come as' +
              ' PowerPoint.'
          : "Every team's project folder is saved with its subfolders, and" +
              ' Teams.xlsx lists the teams with a link from each project to' +
              ' its folder. Google Docs, Sheets and Slides come as Office' +
              ' files.'
      )
    );
    d.body.appendChild(
      h(
        'p',
        { class: 'help' },
        'The files are read in your Google Drive, one team at a time, so it' +
          ' can take a few minutes. Keep this window open. Anything that' +
          ' cannot be saved is listed with the reason and its Drive link.'
      )
    );
    d.body.appendChild(startRow(d, 'Start', true));
  }

  /**
   * Sets the length of the bar: a step for each team and one for
   * Teams.xlsx.
   *
   * @param {!Object} pg The bar and the line.
   * @param {number} n How many teams.
   */
  function begin(pg, n) {
    pg.bar.max = String(n + 1);
  }

  /**
   * Says which team is read, and how many files are saved so far.
   *
   * @param {!Object} pg The bar and the line.
   * @param {!Object} t The team.
   * @param {number} n How many teams.
   * @param {number} files The files saved so far.
   */
  function team(pg, t, n, files) {
    pg.line.textContent =
      'Team ' +
      t.number +
      ' of ' +
      n +
      ': ' +
      (t.title || t.ref) +
      (files ? ' · ' + A.plural(files, 'file', 'files') + ' saved' : '');
  }

  /**
   * Moves the bar to a step.
   *
   * @param {!Object} pg The bar and the line.
   * @param {number} i The step.
   */
  function step(pg, i) {
    pg.bar.value = String(i);
  }

  /**
   * Says Teams.xlsx is written.
   *
   * @param {!Object} pg The bar and the line.
   */
  function writing(pg) {
    pg.line.textContent = 'Writing Teams.xlsx…';
  }

  /**
   * Says which part is packed.
   *
   * @param {!Object} pg The bar and the line.
   * @param {number} p The part, from 0.
   * @param {number} count How many parts.
   */
  function pack(pg, p, count) {
    pg.line.textContent =
      count > 1
        ? 'Packing part ' + (p + 1) + ' of ' + count + '…'
        : 'Packing the zip…';
  }

  /**
   * Fills the bar.
   *
   * @param {!Object} pg The bar and the line.
   */
  function done(pg) {
    pg.bar.value = pg.bar.max;
  }

  /**
   * Draws the progress bar and line, and gives what moves them.
   *
   * @param {!Element} body Where they go.
   * @return {!Object} The progress: begin, team, step, writing, pack and
   *     done.
   */
  function progressOf(body) {
    var pg = {
      bar: h('progress', {
        class: 'download-bar',
        max: '1',
        value: '0',
        'aria-label': 'Progress'
      }),
      line: h('p', { class: 'download-line', role: 'status' }, 'Getting ready…')
    };
    body.appendChild(pg.bar);
    body.appendChild(pg.line);
    return {
      begin: begin.bind(null, pg),
      team: team.bind(null, pg),
      step: step.bind(null, pg),
      writing: writing.bind(null, pg),
      pack: pack.bind(null, pg),
      done: done.bind(null, pg)
    };
  }

  /**
   * Draws why the download stopped, with a button to start again.
   *
   * @param {!Object} d The download.
   * @param {*} e What stopped it.
   */
  function stopped(d, e) {
    ui.clear(d.body);
    d.body.appendChild(
      h(
        'p',
        { class: 'error', role: 'alert' },
        e?.message || 'The download stopped.'
      )
    );
    d.body.appendChild(startRow(d, 'Start again', false));
  }

  /**
   * Runs the download and draws its end, or why it stopped.
   *
   * @param {!Object} d The download.
   * @return {!Promise} Settles once it ends.
   */
  async function run(d) {
    ui.clear(d.body);
    var out;
    d.progress = progressOf(d.body);
    try {
      out = await R.runDownload(d);
      if (!out) return;
      d.progress.done();
      R.downloadFinished(d, out);
    } catch (e) {
      stopped(d, e);
    }
  }

  /**
   * Whether the dialog is still open.
   *
   * @param {!Object} dialog The dialog.
   * @return {boolean} True while it is shown.
   */
  function isOpen(dialog) {
    return !!dialog.el.parentNode;
  }

  /**
   * Opens Download all for a team or task form.
   *
   * @param {!Object} form The form.
   * @return {{close: function(), el: !Element}} The dialog.
   */
  A.downloadAll = function (form) {
    var tasks = form.type === FormType.TASK_SUBMISSION;
    var d = {
      form: form,
      tasks: tasks,
      body: h('div', { class: 'l-stack download' })
    };
    var dialog = A.modal(
      tasks ? 'Download all tasks' : 'Download all projects',
      d.body,
      [{ text: 'Close', kind: 'quiet' }]
    );
    d.open = isOpen.bind(null, dialog);
    d.run = run.bind(null, d);
    intro(d);
    return dialog;
  };
})(window.App);
