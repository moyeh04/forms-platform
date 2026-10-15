/**
 * The settings page of a form: everything an admin can change without
 * touching code, in three tabs. Questions and Timetable are work areas;
 * Setup holds the folded settings. Each panel is drawn by its own part;
 * this page loads the form, places the panels and keeps the save bar.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /**
   * Which sections are open, by form id, so a save (which draws the page
   * again) does not fold them.
   */
  var opened = {};

  /**
   * Loads a form and fills in the settings it has none of yet.
   *
   * @param {string} slug The form.
   * @return {!Promise<!Object>} The settings page: `f`, `res`, `slug`,
   *     `metadata`, and what the form asks (`isTeam`, `isReservation`,
   *     `hasSize`, `hasDrive`, `members`).
   */
  async function load(slug) {
    var res = await A.call('admin.forms.get', { id: slug });
    var f = res.form;
    f.lang = f.lang || { default: 'en', allowSwitch: true };
    f.rules = f.rules || {};
    return {
      f: f,
      res: res,
      slug: slug,
      metadata: FormMetadata.read(f),
      hasSize: !!Rules.fieldByRole(f, 'team_size'),
      hasDrive: (f.fields || []).some(function (x) {
        return x.type === 'drive_link';
      }),
      isTeam:
        f.type === FormType.TEAM_REGISTRATION ||
        f.type === FormType.TASK_SUBMISSION,
      isReservation: f.type === FormType.RESERVATION,
      members: Rules.fieldByRole(f, 'members')
    };
  }

  /**
   * Tells whether a reservation offers no day yet, so its Timetable tab
   * asks for attention.
   *
   * @param {!Object} f The form.
   * @return {boolean} True when it has no day.
   */
  function noDays(f) {
    return !f.slots.days.length;
  }

  /**
   * Keeps whether a section is open.
   *
   * @param {!Object} open The open sections of the form, by title.
   * @param {string} title The section.
   * @param {boolean} isOpen Whether it is open now.
   */
  function remember(open, title, isOpen) {
    open[title] = isOpen;
  }

  /**
   * Draws the panel that deletes the form.
   *
   * @param {!Object} f The form.
   * @return {!Element} The panel.
   */
  function dangerPanel(f) {
    var panel = A.panel(
      'Delete this form',
      'The link stops working and the form leaves the dashboard. Its Google' +
        ' Sheet moves to the Drive trash for 30 days. To stop new' +
        ' registrations but keep everything, set the status to Closed or' +
        ' Archived instead.',
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-danger',
          name: 'delete-form',
          onclick: function () {
            A.deleteForm(f, function () {
              window.location.hash = '#/';
            });
          }
        },
        icon('trash', A.ICON_SIZE.LINE),
        'Delete form'
      )
    );
    panel.classList.add('danger-zone');
    return panel;
  }

  /**
   * Draws the panels of a reservation: its teammates and its timetable.
   *
   * @param {!Object} s The settings page, which keeps them.
   */
  function reservationPanels(s) {
    if (s.members) s.teammates = A.teammatesPanel(s);
    s.timetable = A.timetable(s.f, s.res.taken);
    s.timetablePanel = A.panel(
      'Timetable',
      'Choose the days, set the hours once, and check the result. Students' +
        ' see taken slots crossed out.',
      s.timetable.node
    );
    s.timetablePanel.summary = s.timetable.summary;
  }

  /**
   * Draws every panel and puts them in their tabs. The order matters: the
   * question list reads the section rule, and the teammates reuse the
   * question rows.
   *
   * @param {!Object} s The settings page, which keeps the panels.
   * @return {!Array<!Object>} The tabs: `id`, `label`, `panels`, and
   *     `alert()` when the tab can ask for attention.
   */
  function buildTabs(s) {
    var general = A.generalPanel(s);
    var who = A.whoPanel(s);
    var keyBooking = s.isReservation ? A.keyBookingPanel(s) : null;
    if (s.hasSize) s.size = A.teamSizePanels(s);
    var size = s.size || {};
    var editKey = A.editKeyPanel(s);
    s.editKeyPanel = editKey;
    var limits = A.limitsPanel(s);
    var emails = A.emailsPanel(s);
    s.questionsPanel = A.questionsPanel(s);
    if (s.isReservation) reservationPanels(s);
    var review = A.reviewPanel(s);
    var progress =
      s.f.type === FormType.TEAM_REGISTRATION ? A.progressPanel(s) : null;
    var questions = [s.questionsPanel, size.sizePanel, s.teammates?.panel];
    var setup = [general, who, editKey, emails, limits, size.alertsPanel];
    return [
      { id: 'questions', label: 'Questions', panels: questions },
      s.timetablePanel
        ? {
            id: 'timetable',
            label: 'Timetable',
            panels: [s.timetablePanel, keyBooking],
            alert: noDays.bind(null, s.f)
          }
        : null,
      {
        id: 'settings',
        label: 'Setup',
        panels: setup.concat([review, progress, dangerPanel(s.f)])
      }
    ].filter(Boolean);
  }

  /**
   * Links each panel to its tab, pins the work areas open, and opens the
   * sections that were open before the page was drawn again.
   *
   * @param {!Object} s The settings page: `tabs`. `sections` is set here,
   *     every panel in order.
   */
  function placePanels(s) {
    s.sections = [];
    s.tabs.forEach(function (tab) {
      tab.panels = tab.panels.filter(Boolean);
      tab.panels.forEach(function (n) {
        n.tab = tab;
      });
      s.sections = s.sections.concat(tab.panels);
    });
    s.questionsPanel.pin();
    if (s.timetablePanel) s.timetablePanel.pin();
    opened[s.f.id] = opened[s.f.id] || {};
    var open = opened[s.f.id];
    s.sections.forEach(function (n) {
      if (n.pinned) return;
      n.setOpen(!!open[n.panelTitle]);
      n.onToggle = remember.bind(null, open, n.panelTitle);
    });
  }

  /**
   * Shows a tab and draws the tab bar again. The address follows the tab
   * without loading the page again, so changes in other tabs stay.
   *
   * @param {!Object} s The settings page: `tabs`, `sections`, `tabBar`.
   * @param {!Object} tab The tab.
   */
  function show(s, tab) {
    s.sections.forEach(function (n) {
      n.hidden = n.tab !== tab;
    });
    var alerts = s.tabs
      .filter(function (x) {
        return x.alert?.();
      })
      .map(function (x) {
        return x.id;
      });
    ui.clear(s.tabBar);
    s.tabBar.appendChild(
      A.formTabs(
        s.f,
        tab.id,
        function (id) {
          var next = s.tabs.filter(function (x) {
            return x.id === id;
          })[0];
          if (!next) return false;
          A.setHash('#/f/' + encodeURIComponent(s.slug) + '/' + id);
          show(s, next);
          return true;
        },
        alerts
      )
    );
  }

  /**
   * Draws the settings page of a form.
   *
   * @param {!Element} mount Where the page goes.
   * @param {string} slug The form.
   * @param {string=} startTab The tab to open; Setup when absent.
   * @return {!Promise} Settles once it is drawn.
   */
  A.views.settings = async function (mount, slug, startTab) {
    var s = await load(slug);
    ui.clear(mount);
    mount.appendChild(A.formHead(s.f));
    s.tabs = buildTabs(s);
    placePanels(s);
    s.tabBar = h('div');
    s.show = show.bind(null, s);
    var bar = A.saveBar(s);
    // Controls change the form object in their own handlers; these run
    // after them, as the event reaches the page.
    ['input', 'change', 'click'].forEach(function (type) {
      mount.addEventListener(type, bar.refresh);
    });
    mount.appendChild(s.tabBar);
    s.sections.forEach(function (n) {
      mount.appendChild(n);
    });
    mount.appendChild(bar.node);
    s.show(
      s.tabs.filter(function (tab) {
        return tab.id === startTab;
      })[0] || s.tabs[s.tabs.length - 1]
    );
    bar.refresh();
  };
})(window.App);
