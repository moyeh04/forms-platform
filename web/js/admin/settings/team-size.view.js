/**
 * The Team size panel of the Questions tab and the Small teams panel of
 * Setup. The warnings decide what the admin and instructors see, not what
 * students are asked, so they live in Setup.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /** The team size of a form that has none yet, and the bounds. */
  var TEAM_SIZE = { MIN: 1, MAX: 6, FLOOR: 1, CEILING: 20 };

  var WORDS = {
    name: 'Team size',
    min: 'Minimum team size',
    max: 'Maximum team size',
    choose: 'Students will choose from',
    who: 'A student who picks',
    one: 'saved team',
    many: 'saved teams',
    stay: 'registered',
    fix: 'to change the team size',
    note: 'Note for some team sizes',
    noteFor: 'Show the note for teams of',
    noteHelp:
      'Show a short note when a student picks one of the sizes you switch' +
      ' on, for example to say that other students will be added to small' +
      ' teams.',
    placeholder: {
      en: 'Other students will be added to your team to reach {max}.',
      ar: 'هيتضاف طلاب تانيين لفريقك لحد ما يبقى {max}.'
    }
  };

  /**
   * Gives the folded line of the Team size panel.
   *
   * @param {!Object} f The form.
   * @return {string} The sizes.
   */
  function sizeSummary(f) {
    var min = f.rules.teamSize.min;
    var max = f.rules.teamSize.max;
    return String(min) === String(max)
      ? A.plural(parseInt(min, 10) || 0, 'person', 'people')
      : min + ' to ' + max + ' people';
  }

  /**
   * Draws the Team size and Small teams panels. f.rules.teamSize is
   * filled in.
   *
   * @param {!Object} s The settings page: `f`, and `res.teamSizes`, the
   *     saved teams by size.
   * @return {!Object} `sizePanel`, `sizeRange`, `alertsPanel`,
   *     `sizeAlerts`.
   */
  A.teamSizePanels = function (s) {
    var f = s.f;
    f.rules.teamSize = f.rules.teamSize || {
      min: TEAM_SIZE.MIN,
      max: TEAM_SIZE.MAX
    };
    var sizeRange = A.sizeRange(f.rules.teamSize, {
      floor: TEAM_SIZE.FLOOR,
      ceiling: TEAM_SIZE.CEILING,
      counts: s.res.teamSizes,
      names: {
        min: 'teamMin',
        max: 'teamMax',
        outside: 'size-conflicts',
        note: ''
      },
      words: WORDS
    });
    var sizePanel = A.panel(
      'Team size',
      'Students must say how many people are in the team, then fill in' +
        ' exactly that many member forms. The number counts the leader, so a' +
        ' team of 1 works alone.',
      sizeRange.node
    );
    sizePanel.summary = sizeSummary.bind(null, f);
    var sizeAlerts = A.sizeAlerts(f);
    var alertsPanel = A.panel(
      'Small teams',
      [
        'A team can end up small, for example when one of its members moves' +
          ' to another team. Teams with fewer people than the number you set' +
          ' are marked under Responses. Each instructor link decides whether' +
          ' it shows them too, under ',
        h('a', { href: '#/clients' }, 'Clients'),
        '.'
      ],
      sizeAlerts.node
    );
    alertsPanel.summary = sizeAlerts.summary;
    // The warnings are bounded by the biggest team size, set in the
    // Questions tab, so they are drawn again when the range changes.
    sizeRange.node.addEventListener('input', sizeAlerts.refresh);
    return {
      sizePanel: sizePanel,
      sizeRange: sizeRange,
      alertsPanel: alertsPanel,
      sizeAlerts: sizeAlerts
    };
  };
})(window.App);
