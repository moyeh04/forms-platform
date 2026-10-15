/**
 * What the settings page saves and what stops a save. The page keeps its
 * parts on `s`: the form `f`, its `metadata`, the teammates question
 * `members`, and the controls that can refuse a save (`questions`,
 * `size`, `teammates`, `timetable`, each with its panel).
 */
(function (App) {
  'use strict';

  var A = App.admin;

  /**
   * Reads the teammates question as the server stores it: whether it is
   * asked, its range as numbers, and required when at least one comes.
   *
   * @param {!Object} tm The teammates question, changed in place.
   */
  function settleMembers(tm) {
    tm.enabled = !!tm.enabled;
    tm.min = parseInt(tm.min, 10);
    tm.max = parseInt(tm.max, 10);
    tm.required = tm.enabled && tm.min >= 1;
  }

  /**
   * Gives the rules as the server stores them: the team size as numbers,
   * with its note only when a size shows it.
   *
   * @param {!Object} rules The rules.
   * @return {!Object} A copy.
   */
  function rulesWithSize(rules) {
    var size = rules.teamSize;
    var note = size.notice;
    return Object.assign({}, rules, {
      teamSize: {
        min: parseInt(size.min, 10),
        max: parseInt(size.max, 10),
        notice: note?.sizes.length ? note : null
      }
    });
  }

  /**
   * Adds what a reservation saves: its booking with a key and its
   * timetable. The teammates question is read as the server stores it.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} patch The patch, changed in place.
   */
  function addReservation(s, patch) {
    var kb = s.f.keyBooking;
    if (s.members) settleMembers(s.members);
    patch.keyBooking = { enabled: !!kb.enabled, source: kb.source || '' };
    if (s.timetable) patch.slots = s.timetable.slots();
  }

  /**
   * Gives everything the page can change, as the server expects it. It is
   * also compared with the saved copy to know if there is something to
   * save. The status is not here: the header saves it by itself.
   *
   * @param {!Object} s The settings page.
   * @return {!Object} The patch.
   */
  A.settingsPatch = function (s) {
    var f = s.f;
    var patch = {
      title: f.title,
      slug: f.slug,
      opensAt: f.opensAt || '',
      closesAt: f.closesAt || '',
      lang: f.lang,
      icon: f.icon,
      editKey: f.editKey,
      rules: f.rules,
      notifications: f.notifications,
      fields: f.fields,
      review: f.review
    };
    if (f.steps) patch.steps = f.steps;
    Object.assign(patch, s.metadata);
    if (f.matching) patch.matching = f.matching;
    if (s.size) patch.rules = rulesWithSize(f.rules);
    if (s.isReservation) addReservation(s, patch);
    return patch;
  };

  /**
   * Gives the first thing that stops a save, with the panel it is in.
   *
   * @param {!Object} s The settings page.
   * @return {?{panel: !Element, text: string}} The problem; null when the
   *     page can be saved.
   */
  A.settingsProblem = function (s) {
    var text = A.questions.problem(s.f);
    if (text) return { panel: s.questionsPanel, text: text };
    var checks = [];
    if (s.size) {
      checks.push(
        { panel: s.size.sizePanel, control: s.size.sizeRange },
        { panel: s.size.alertsPanel, control: s.size.sizeAlerts }
      );
    }
    if (s.teammates && s.members.enabled !== false) {
      checks.push({ panel: s.teammates.panel, control: s.teammates.range });
    }
    if (s.timetable) {
      checks.push({ panel: s.timetablePanel, control: s.timetable });
    }
    var stop = null;
    checks.some(function (c) {
      var reason = c.control.problem();
      if (reason) stop = { panel: c.panel, text: reason };
      return !!reason;
    });
    return stop;
  };
})(window.App);
