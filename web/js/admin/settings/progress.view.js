/**
 * The Progress panel of a team registration: the milestones list the form
 * copies, the copy itself, Update from list when the list changed since,
 * and whether teams see their own progress. A change that hides marks says
 * how many before the save.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Lists the milestones lists, as select options.
   *
   * @param {!Object} res What `admin.forms.get` answered: `lists` and
   *     `listInfo`.
   * @return {!Array<!Array<string>>} Each list: its key and its name.
   */
  function milestoneLists(res) {
    return Object.keys(res.lists || {})
      .filter(function (k) {
        return A.listKind(k, res.listInfo) === ListKind.MILESTONES;
      })
      .map(function (k) {
        return [k, A.listName(k, res.listInfo)];
      });
  }

  /**
   * Gives the milestones the list of the form has now.
   *
   * @param {!Object} g The panel.
   * @return {?Array<!Object>} The milestones, or null when the list is gone.
   */
  function fromList(g) {
    var list = g.res.lists?.[g.f.progress.from];
    return list ? Rules.milestonesFromList(list) : null;
  }

  /**
   * Draws the copy: the names of the milestones, in order.
   *
   * @param {!Array<!Object>} milestones The milestones.
   * @return {!Element} The list.
   */
  function copyList(milestones) {
    return h(
      'ol',
      { class: 'progress-copy' },
      milestones.map(function (m) {
        return h(
          'li',
          null,
          m.label.en,
          m.label.ar !== m.label.en
            ? h('span', { class: 'muted-note', lang: 'ar' }, ' · ' + m.label.ar)
            : null
        );
      })
    );
  }

  /**
   * Says what Update from list would change.
   *
   * @param {!Object} d The difference, from `Rules.milestonesDiff`.
   * @return {string} The change in words.
   */
  function diffText(d) {
    var parts = [];
    if (d.added.length) parts.push(d.added.length + ' added');
    if (d.renamed.length) parts.push(d.renamed.length + ' renamed');
    if (d.removed.length) parts.push(d.removed.length + ' removed');
    if (d.moved) parts.push('order changed');
    return parts.join(', ');
  }

  /**
   * Draws Update from list, only while the list differs from the copy.
   *
   * @param {!Object} g The panel.
   * @return {?Element} The box, or null.
   */
  function updateBox(g) {
    var now = fromList(g);
    if (!now) {
      return h(
        'p',
        { class: 'muted-note' },
        'Its list was deleted. The form keeps its copy.'
      );
    }
    var d = Rules.milestonesDiff(g.f.progress.milestones, now);
    if (d.same) return null;
    return h(
      'div',
      { class: 'progress-update' },
      h(
        'p',
        null,
        A.listName(g.f.progress.from, g.res.listInfo) +
          ' changed since this form copied it: ' +
          diffText(d) +
          '.'
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          name: 'progress-update',
          onclick: function () {
            g.f.progress.milestones = now;
            g.paint();
          }
        },
        'Update from list'
      )
    );
  }

  /**
   * Draws the warning about marks the change would hide, with their count.
   *
   * @param {!Object} g The panel.
   * @return {?Element} The warning, or null.
   */
  function hiddenWarning(g) {
    var now = g.f.progress ? g.f.progress.milestones : [];
    var hidden = Rules.marksHidden(g.saved, now, g.res.progressMarks || {});
    if (!hidden.length) return null;
    return h(
      'div',
      { class: 'banner', role: 'alert', name: 'progress-hidden' },
      hidden
        .map(function (x) {
          return (
            x.label.en +
            ' has marks for ' +
            A.plural(x.teams, 'team', 'teams') +
            '.'
          );
        })
        .join(' ') +
        ' Without it they are no longer shown; they stay in the sheet.'
    );
  }

  /**
   * Draws the switch for students, or while keys are off, why there is
   * none.
   *
   * @param {!Object} g The panel.
   * @return {!Element} The row.
   */
  function studentsRow(g) {
    if (!g.f.editKey.enabled) {
      return h(
        'p',
        { class: 'muted-note', name: 'progress-students-off' },
        'Teams can see their progress once edit keys are on. ',
        h(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            onclick: function () {
              g.s.editKeyPanel.setOpen(true);
              g.s.editKeyPanel.scrollIntoView({ block: 'start' });
            }
          },
          'Open Edit key'
        )
      );
    }
    return A.check(
      'Teams see their progress when they open their registration with' +
        ' the edit key',
      g.f.progress.students !== false,
      function (v) {
        g.f.progress.students = v;
      },
      { name: 'progress-students' }
    );
  }

  /**
   * Draws the part under the select again.
   *
   * @param {!Object} g The panel.
   */
  function paint(g) {
    ui.clear(g.box);
    var p = g.f.progress;
    var upd = p ? updateBox(g) : null;
    if (p) {
      g.box.appendChild(copyList(p.milestones));
      if (upd) g.box.appendChild(upd);
      g.studentsBox = h('div', { class: 'field-row' }, studentsRow(g));
      g.box.appendChild(g.studentsBox);
      g.keyOn = g.f.editKey.enabled;
    }
    var warn = hiddenWarning(g);
    if (warn) g.box.appendChild(warn);
  }

  /**
   * Picks a list: the form copies its milestones now. None turns progress
   * off.
   *
   * @param {!Object} g The panel.
   * @param {string} key The list, or ''.
   */
  function pick(g, key) {
    var students = g.f.progress ? g.f.progress.students : true;
    g.f.progress = key
      ? {
          from: key,
          milestones: Rules.milestonesFromList(g.res.lists[key]),
          students: students
        }
      : null;
    g.paint();
  }

  /**
   * Draws the select of the list, or the way to make a first one.
   *
   * @param {!Object} g The panel.
   * @return {!Element} The select or the line.
   */
  function listPick(g) {
    var lists = milestoneLists(g.res);
    var from = g.f.progress?.from || '';
    if (!lists.length && !from) {
      return h(
        'p',
        { class: 'muted-note', name: 'progress-no-list' },
        'Make a list of milestones on the Lists page first. ',
        h('a', { href: '#/lists/new' }, 'Open Lists')
      );
    }
    var known = lists.some(function (o) {
      return o[0] === from;
    });
    var options = [['', 'None (no progress)']].concat(lists);
    if (from && !known) options.push([from, 'The copy this form has']);
    var sel = A.select(from, options, pick.bind(null, g));
    sel.name = 'progress-from';
    return A.field('Milestones from', sel);
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} g The panel.
   * @return {string} Off, or the list, the count and who sees it.
   */
  function summary(g) {
    var p = g.f.progress;
    if (!p) return 'Off';
    var seen = g.f.editKey.enabled && p.students !== false;
    return (
      A.listName(p.from, g.res.listInfo) +
      ' · ' +
      p.milestones.length +
      (seen ? ' · teams see it' : '')
    );
  }

  /**
   * Draws the Progress panel of a team registration. f.progress is filled
   * in.
   *
   * @param {!Object} s The settings page: `f`, `res` and `editKeyPanel`.
   * @return {!Element} The panel.
   */
  A.progressPanel = function (s) {
    s.f.progress = s.f.progress || null;
    var g = {
      s: s,
      f: s.f,
      res: s.res,
      saved: s.f.progress ? s.f.progress.milestones.slice() : [],
      box: h('div')
    };
    g.paint = paint.bind(null, g);
    var panel = A.panel(
      'Progress',
      'Follow each team through the milestones of the project: what it' +
        ' submitted and what was discussed. Review steps are different: they' +
        ' accept or reject the registration itself.',
      listPick(g),
      g.box
    );
    g.paint();
    panel.summary = summary.bind(null, g);
    /** Draws the panel again when edit keys were turned on or off. */
    panel.refresh = function () {
      if (g.f.progress && g.keyOn !== g.f.editKey.enabled) g.paint();
    };
    return panel;
  };
})(window.App);
