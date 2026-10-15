/**
 * The toolbar of the Responses page: the search, the status filter,
 * Refresh, Download CSV, and the print and download buttons each form
 * type has.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /**
   * Draws a small quiet button with an icon.
   *
   * @param {string} iconName The icon.
   * @param {string} text The text.
   * @param {function(!Event)} onclick What it does.
   * @param {string=} name The name the tests find it by.
   * @return {!Element} The button.
   */
  function toolButton(iconName, text, onclick, name) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        name: name,
        onclick: onclick
      },
      icon(iconName, A.ICON_SIZE.LINE),
      text
    );
  }

  /**
   * Draws the search box and the status filter.
   *
   * @param {!Object} p The page.
   * @return {!Array<!Element>} The two controls.
   */
  function filters(p) {
    var search = h('input', {
      class: 'input',
      type: 'search',
      name: 'search',
      placeholder: 'Search name, code, phone, project',
      'aria-label': 'Search',
      oninput: function (e) {
        p.state.q = e.target.value;
        p.paint();
      }
    });
    var statusSel = A.select(
      'all',
      [['all', 'All statuses']].concat(
        A.SUB_STATUSES.map(function (s) {
          return [s, A.SUB_LABEL[s]];
        })
      ),
      function (v) {
        p.state.status = v;
        p.paint();
      }
    );
    statusSel.setAttribute('aria-label', 'Filter by status');
    return [search, statusSel];
  }

  /**
   * Draws the buttons of teams and tasks: the team list to print, and
   * Download all once there is something to download.
   *
   * @param {!Object} p The page.
   * @return {!Array<!Element>} The buttons.
   */
  function teamTools(p) {
    var form = p.form;
    var tools = [
      toolButton(
        'printer',
        'Print team list',
        function (e) {
          R.printOut(e.currentTarget, 'admin.print.teamList', {});
        },
        'printTeams'
      )
    ];
    if (p.all.length) {
      tools.push(
        toolButton(
          'download',
          form.type === FormType.TASK_SUBMISSION
            ? 'Download all tasks'
            : 'Download all projects',
          function () {
            A.downloadAll(form);
          },
          'download-all'
        )
      );
    }
    return tools;
  }

  /**
   * Draws the day sheet of a reservation: the day, whether empty slots
   * are printed, and the button. One labelled group, so the day and the
   * option stay next to the button they belong to.
   *
   * @param {!Array<!Object>} days The days of the timetable.
   * @return {!Element} The group.
   */
  function daySheet(days) {
    var choice = { dayId: days[0].id, includeEmpty: false };
    var daySel = A.select(
      choice.dayId,
      days.map(function (d) {
        return [d.id, d.label];
      }),
      function (v) {
        choice.dayId = v;
      }
    );
    daySel.setAttribute('aria-label', 'Day to print');
    return h(
      'div',
      { class: 'tool-group', role: 'group', 'aria-label': 'Print a day sheet' },
      h('span', { class: 'tool-label' }, 'Day sheet'),
      daySel,
      A.check('Include empty slots', false, function (v) {
        choice.includeEmpty = v;
      }),
      toolButton(
        'printer',
        'Print this day',
        function (e) {
          R.printOut(e.currentTarget, 'admin.print.reservations', {
            dayId: choice.dayId,
            includeEmpty: choice.includeEmpty
          });
        },
        'printDay'
      )
    );
  }

  /**
   * Draws the toolbar of the page.
   *
   * @param {!Object} p The page: form, all, state, paint, reload and
   *     filtered.
   * @return {!Element} The toolbar.
   */
  R.toolbar = function (p) {
    var form = p.form;
    var days = form.slots?.days || [];
    var tools = filters(p).concat([
      toolButton('refresh', 'Refresh', p.reload),
      toolButton('download', 'Download CSV', function () {
        R.downloadCsv(form, p.filtered());
      })
    ]);
    if (
      form.type === FormType.TEAM_REGISTRATION ||
      form.type === FormType.TASK_SUBMISSION
    ) {
      tools = tools.concat(teamTools(p));
    }
    if (Rules.progressOn(form)) {
      tools.unshift(
        App.progress.viewSwitch(form.slug, p.state.view, function (v) {
          p.state.view = v;
          p.toolbar.replaceWith(R.toolbar(p));
          p.paint();
        })
      );
    }
    // A day sheet needs a day: a reservation with no days has nothing to print.
    if (form.type === FormType.RESERVATION && days.length) {
      tools.push(daySheet(days));
    }
    p.toolbar = h('div', { class: 'toolbar' }, tools);
    return p.toolbar;
  };
})(window.App);
