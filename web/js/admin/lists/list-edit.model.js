/**
 * The open list as it is edited, with no drawing: which list is open,
 * whether it differs from its saved copy, what stops a save and what a
 * save would change. The page keeps all of it in one object, `p`.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;

  /**
   * Gives the keys of every list.
   *
   * @param {!Object} p The page.
   * @return {!Array<string>} The keys.
   */
  L.keys = function (p) {
    return Object.keys(p.lists);
  };

  /**
   * Gives the kind of a list.
   *
   * @param {!Object} p The page.
   * @param {string=} k The list, or the open one.
   * @return {string} The kind.
   */
  L.kindOf = function (p, k) {
    return A.listKind(k || p.key, p.info);
  };

  /**
   * Gives the name of a list.
   *
   * @param {!Object} p The page.
   * @param {string=} k The list, or the open one.
   * @return {string} The name.
   */
  L.nameOf = function (p, k) {
    return A.listName(k || p.key, p.info);
  };

  /**
   * Opens a list from its saved copy, leaving every edit behind.
   *
   * @param {!Object} p The page.
   * @param {string} key The list.
   */
  L.load = function (p, key) {
    p.key = key;
    p.rows = L.toRows(p.lists[key]);
    p.order = false;
    p.renaming = false;
    p.draft = null;
    p.sections =
      L.kindOf(p) === ListKind.SECTIONS ? L.readSections(L.values(p)) : null;
  };

  /**
   * Gives the values of the rows.
   *
   * @param {!Object} p The page.
   * @return {!Array<string>} The values.
   */
  L.values = function (p) {
    return p.rows.map(function (r) {
      return r.value;
    });
  };

  /**
   * Whether the open list differs from its saved copy, or has a row with a
   * name and no value.
   *
   * @param {!Object} p The page.
   * @return {boolean} True when a save is needed.
   */
  L.dirty = function (p) {
    return (
      !p.creating &&
      (JSON.stringify(L.fromRows(p.rows)) !==
        JSON.stringify(L.fromRows(L.toRows(p.lists[p.key]))) ||
        p.rows.some(function (r) {
          return !r.value.trim() && (r.en.trim() || r.ar.trim());
        }))
    );
  };

  /**
   * Whether a row has a name.
   *
   * @param {!Object} p The page.
   * @return {boolean} True when one does.
   */
  L.named = function (p) {
    return p.rows.some(function (r) {
      return r.en || r.ar;
    });
  };

  /**
   * Whether the choices are drawn as rows. Rows are needed for names and
   * order; plain values read best as chips.
   *
   * @param {!Object} p The page.
   * @return {boolean} True for rows.
   */
  L.asRows = function (p) {
    return L.kindOf(p) === ListKind.NAMED || p.order || L.named(p);
  };

  /**
   * Says what is wrong with a row: a name with no value, or a value seen
   * before.
   *
   * @param {!Object} r The row.
   * @param {number} i Where it is, from 0.
   * @param {!Object<string, boolean>} seen The values seen so far.
   * @return {string} The reason, or ''.
   */
  function rowProblem(r, i, seen) {
    var v = r.value.trim();
    if (!v && (r.en.trim() || r.ar.trim())) {
      return (
        'Choice ' +
        (i + 1) +
        ' has a name but no value. Write the choice or remove the row.'
      );
    }
    if (v && seen[v])
      return '"' + v + '" is in the list twice. Remove one of them.';
    return '';
  }

  /**
   * Finds the first thing that stops a save.
   *
   * @param {!Object} p The page.
   * @return {{text: string, at: number}} The reason, or '', and the row to
   *     mark, or -1.
   */
  L.problem = function (p) {
    var seen = {};
    var out = { text: '', at: -1 };
    p.rows.some(function (r, i) {
      var text = rowProblem(r, i, seen);
      if (text) out = { text: text, at: i };
      seen[r.value.trim()] = true;
      return text;
    });
    if (!out.text && !L.fromRows(p.rows).length) {
      out.text = 'A list needs at least one choice.';
    }
    return out;
  };

  /**
   * Keeps the forms limited to a value a save removes from this list
   * (rules.majors, rules.sections): they lose that value.
   *
   * @param {!Object} p The page.
   * @param {!Array<string>} removed The values removed.
   * @return {!Array<!Object>} The forms.
   */
  function limitedForms(p, removed) {
    var rule = '';
    if (p.key === 'majors') rule = 'majors';
    else if (L.kindOf(p) === ListKind.SECTIONS) rule = 'sections';
    if (!rule) return [];
    return L.formsUsing(p.forms, p.key).filter(function (f) {
      return (f.rules?.[rule] || []).some(function (v) {
        return removed.indexOf(String(v)) !== -1;
      });
    });
  }

  /**
   * Says what a save would change, and which forms it limits.
   *
   * @param {!Object} p The page.
   * @return {{text: string, limited: !Array<!Object>}} The change in words
   *     and the forms limited to a removed value.
   */
  L.changes = function (p) {
    var before = (p.lists[p.key] || []).map(function (o) {
      return String(o.value);
    });
    var now = L.fromRows(p.rows).map(function (o) {
      return o.value;
    });
    var added = now.filter(function (v) {
      return before.indexOf(v) === -1;
    });
    var removed = before.filter(function (v) {
      return now.indexOf(v) === -1;
    });
    var parts = [];
    if (added.length) parts.push(added.length + ' added');
    if (removed.length) parts.push(removed.length + ' removed');
    if (!parts.length) parts.push('names or order changed');
    return { text: parts.join(', '), limited: limitedForms(p, removed) };
  };
})(window.App);
