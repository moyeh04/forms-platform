/**
 * The rules of a new year group, with no drawing: its name, how many
 * sections it has, and what stops it being added. They read the card
 * object, `dr`: the page, the draft and the kinds it offers.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;

  /**
   * Gives the name of the new group, such as 4C.
   *
   * @param {!Object} dr The card: page, draft and kinds.
   * @return {string} The name, or '' while a part is missing.
   */
  L.draftName = function (dr) {
    var d = dr.d;
    return d.year && d.letter ? d.year + d.letter : '';
  };

  /**
   * Counts the sections of the new group.
   *
   * @param {!Object} dr The card: page, draft and kinds.
   * @return {number} The sections.
   */
  L.draftTotal = function (dr) {
    return dr.kinds.reduce(function (n, k) {
      return n + (dr.d.counts[k] || 0);
    }, 0);
  };

  /**
   * Whether the list already has a group of that name.
   *
   * @param {!Object} dr The card: page, draft and kinds.
   * @return {boolean} True when it has.
   */
  L.draftExists = function (dr) {
    var name = L.draftName(dr);
    return dr.p.sections.groups.some(function (g) {
      return g.name === name;
    });
  };

  /**
   * Says what stops the group being added.
   *
   * @param {!Object} dr The card: page, draft and kinds.
   * @return {string} The reason, or ''.
   */
  L.draftMissing = function (dr) {
    var d = dr.d;
    var why = '';
    if (!d.year && !d.letter) why = 'Pick a year and a department letter.';
    else if (!d.year) why = 'Pick a year.';
    else if (!d.letter) why = 'Pick a department letter.';
    else if (L.draftExists(dr))
      why = L.draftName(dr) + ' is already in this list.';
    else if (!L.draftTotal(dr)) why = 'Set at least one kind above 0.';
    if (!dr.kinds.length && !why) why = 'Add a kind, such as TH.';
    return why;
  };

  /**
   * Whether the group can be added.
   *
   * @param {!Object} dr The card: page, draft and kinds.
   * @return {boolean} True when it can.
   */
  L.draftReady = function (dr) {
    return !!L.draftName(dr) && !L.draftExists(dr) && L.draftTotal(dr) > 0;
  };
})(window.App);
