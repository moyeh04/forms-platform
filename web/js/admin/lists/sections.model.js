/**
 * A section list as year groups × kinds × counts, with no drawing: how
 * "4C-TH1 … 4C-TH8, 4C-T1 …" reads as groups and writes back, where a new
 * group goes, and the kinds, letters and years a new group can pick.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;

  /**
   * The years offered for a new year group: 1 to 5, and any higher year a
   * section list already uses. (A level counts from 0, but a section is
   * named by the year.) The kinds and the letters come from the lists.
   */
  var YEARS = ['1', '2', '3', '4', '5'];

  /**
   * Adds a value read from a section to its group and kind.
   *
   * @param {!Array<!Object>} groups The groups so far.
   * @param {!Array<string>} m The parts: group, kind and number.
   */
  function addValue(groups, m) {
    var g = groups.filter(function (x) {
      return x.name === m[1];
    })[0];
    if (!g) {
      g = { name: m[1], kinds: [] };
      groups.push(g);
    }
    var k = g.kinds.filter(function (x) {
      return x.code === m[2];
    })[0];
    if (!k) {
      k = { code: m[2], count: 0, nums: [] };
      g.kinds.push(k);
    }
    k.nums.push(+m[3]);
  }

  /**
   * Turns the numbers of a kind into a count when they run from 1 with no
   * gap; otherwise the values go to the extras and the kind is dropped.
   *
   * @param {!Object} g The group.
   * @param {!Array<string>} extras The values kept as written.
   */
  function settleKinds(g, extras) {
    g.kinds.forEach(function (k) {
      var whole = k.nums
        .slice()
        .sort(function (a, b) {
          return a - b;
        })
        .every(function (n, i) {
          return n === i + 1;
        });
      if (whole) {
        k.count = k.nums.length;
      } else {
        k.nums.forEach(function (n) {
          extras.push(g.name + '-' + k.code + n);
        });
        k.count = 0;
      }
      delete k.nums;
    });
    g.kinds = g.kinds.filter(function (k) {
      return k.count;
    });
  }

  /**
   * Reads "4C-TH1 … 4C-TH8, 4C-T1 …" as
   * [{ name: '4C', kinds: [{ code: 'TH', count: 8 }, …] }]. A value that
   * the groups cannot give back exactly (a gap, another shape) is kept in
   * `extras`.
   *
   * @param {!Array<string>} values The values.
   * @return {{groups: !Array<!Object>, extras: !Array<string>}} The groups.
   */
  L.readSections = function (values) {
    var groups = [];
    var extras = [];
    values.forEach(function (v) {
      var m = /^([^-\s]+)-([A-Za-z]+)(\d+)$/.exec(v);
      // "4C-TH01" is kept as written: a card would write it back as "4C-TH1".
      if (!m || String(+m[3]) !== m[3]) extras.push(v);
      else addValue(groups, m);
    });
    groups.forEach(function (g) {
      settleKinds(g, extras);
    });
    return {
      groups: groups.filter(function (g) {
        return g.kinds.length;
      }),
      extras: extras
    };
  };

  /**
   * Writes the groups back as values, then the extras they do not give.
   *
   * @param {{groups: !Array<!Object>, extras: !Array<string>}} s The groups.
   * @return {!Array<string>} The values.
   */
  L.writeSections = function (s) {
    var out = [];
    s.groups.forEach(function (g) {
      g.kinds.forEach(function (k) {
        var n;
        for (n = 1; n <= k.count; n++) out.push(g.name + '-' + k.code + n);
      });
    });
    return out.concat(
      s.extras.filter(function (v) {
        return out.indexOf(v) === -1;
      })
    );
  };

  /**
   * Reads a group name: "4C" is the year 4 and the letter C.
   *
   * @param {string} name The name.
   * @return {?{year: string, letter: string}} The parts, or null.
   */
  L.groupParts = function (name) {
    var m = /^(\d+)([A-Za-z]+)$/.exec(name);
    return m ? { year: m[1], letter: m[2].toUpperCase() } : null;
  };

  /**
   * Finds where a new year group goes: before the first group with a
   * higher year, or the same year and a later letter.
   *
   * @param {!Array<!Object>} groups The groups.
   * @param {string} name The new group.
   * @return {number} Its place.
   */
  L.groupSlot = function (groups, name) {
    var p = L.groupParts(name);
    var q;
    var i;
    for (i = 0; p && i < groups.length; i++) {
      q = L.groupParts(groups[i].name);
      if (
        q &&
        (+q.year > +p.year || (q.year === p.year && q.letter > p.letter))
      ) {
        return i;
      }
    }
    return groups.length;
  };

  /**
   * Cleans a kind or a department letter as it is typed: letters only,
   * upper case.
   *
   * @param {*} v What was typed.
   * @param {number} max The most letters.
   * @return {string} The code.
   */
  L.cleanCode = function (v, max) {
    return String(v || '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, max);
  };

  /**
   * Adds a value to a list once.
   *
   * @param {!Array<string>} arr The list.
   * @param {string} v The value.
   */
  function know(arr, v) {
    if (v && arr.indexOf(v) === -1) arr.push(v);
  }

  /**
   * Adds the kinds, letters and years of groups.
   *
   * @param {!Object} out The parts so far.
   * @param {!Array<!Object>} groups The groups.
   */
  function takeParts(out, groups) {
    groups.forEach(function (g) {
      var p = L.groupParts(g.name);
      if (p) {
        know(out.letters, p.letter);
        know(out.years, String(+p.year));
      }
      g.kinds.forEach(function (k) {
        know(out.kinds, k.code);
      });
    });
  }

  /**
   * Gives the kinds, letters and years the section lists use, in the
   * order they first appear (the groups being edited first, then the
   * saved lists). Nothing typed is kept apart from a group that uses it,
   * so a typo leaves no chip behind.
   *
   * @param {!Object} p The page.
   * @param {!Object} s The groups being edited.
   * @return {{kinds: !Array<string>, letters: !Array<string>,
   *     years: !Array<string>}} The parts.
   */
  L.sectionParts = function (p, s) {
    var out = { kinds: [], letters: [], years: YEARS.slice() };
    takeParts(out, s.groups);
    L.keys(p).forEach(function (k) {
      // The saved copy of this list counts too, so a kind removed in this
      // edit can be added back.
      if (L.kindOf(p, k) === ListKind.SECTIONS) {
        takeParts(
          out,
          L.readSections(
            (p.lists[k] || []).map(function (o) {
              return String(o.value);
            })
          ).groups
        );
      }
    });
    out.years.sort(function (x, y) {
      return x - y;
    });
    return out;
  };

  /**
   * Says why a typed kind is refused: it is empty, or already known in
   * any case.
   *
   * @param {string} code The kind.
   * @param {!Array<string>} known The kinds known.
   * @return {string} The reason, or ''.
   */
  L.newKindProblem = function (code, known) {
    if (!code) return 'Type the letters of the kind, such as TH.';
    return known.some(function (k) {
      return k.toUpperCase() === code;
    })
      ? code + ' is already a kind.'
      : '';
  };
})(window.App);
