/**
 * The rules of the Responses page that draw nothing: what a search looks
 * through, which teams are under the minimum size, how bookings group by
 * day, the order of WhatsApp registrations and the rows of the CSV file.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Rules = window.Rules;
  var R = {};
  A.responses = R;

  /** The columns of the CSV file before the questions the admin added. */
  var CSV_HEAD = [
    'Reference',
    'Sent',
    'Status',
    'Name',
    'Code',
    'Phone',
    'Email',
    'Title',
    'Link',
    'Slot',
    'Members'
  ];

  /**
   * Names a booked slot by its day and time.
   *
   * @param {!Object} form The form.
   * @param {?Object} slot The slot, { day, time }.
   * @return {string} The text, or '' for none.
   */
  R.slotText = function (form, slot) {
    if (!slot) return '';
    var day = (form.slots?.days || []).filter(function (d) {
      return d.id === slot.day;
    })[0];
    return (day ? day.label : slot.day) + ' - ' + slot.time;
  };

  /**
   * Gives the text a search looks through: the reference, the contact
   * details, the title and every member.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {string} The text, in lower case.
   */
  function haystack(form, s) {
    var members = Rules.membersOf(form, s.data)
      .map(function (m) {
        return m.name + ' ' + m.code + ' ' + m.phone;
      })
      .join(' ');
    return [s.ref, s.email, s.name, s.code, s.phone, s.title, members]
      .join(' ')
      .toLowerCase();
  }

  /**
   * Keeps the submissions that match the search and the status filter.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} all Every submission.
   * @param {{q: string, status: string}} state The filters.
   * @return {!Array<!Object>} The submissions shown.
   */
  R.filtered = function (form, all, state) {
    var q = state.q.trim().toLowerCase();
    return all.filter(function (s) {
      return (
        (state.status === 'all' || s.status === state.status) &&
        (!q || haystack(form, s).indexOf(q) !== -1)
      );
    });
  };

  /**
   * Whether the form has the WhatsApp matching tab.
   *
   * @param {!Object} form The form.
   * @return {boolean} True when matching is on.
   */
  R.hasMatching = function (form) {
    return !!(
      form.type === FormType.WHATSAPP_REGISTRATION &&
      form.matching &&
      form.matching.enabled
    );
  };

  /**
   * Keeps the teams with fewer members than the minimum team size.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} all Every submission.
   * @param {?Object} sizeField The team size question, or null.
   * @return {!Array<!Object>} The teams under the minimum.
   */
  R.underMin = function (form, all, sizeField) {
    if (!sizeField) return [];
    var min = Rules.teamSizeRange(form).min;
    return all.filter(function (s) {
      return parseInt(s.data[sizeField.id], 10) < min;
    });
  };

  /**
   * Groups bookings by the day of their slot, in the order of the
   * timetable. A slot whose day was removed gets a group of its own.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The bookings.
   * @return {!Array<!Object>} The days that hold bookings, each with rows.
   */
  R.dayGroups = function (form, rows) {
    var groups = (form.slots?.days || []).map(function (d) {
      return { id: d.id, label: d.label, date: d.date, times: d.times };
    });
    groups.forEach(function (g) {
      g.rows = [];
    });
    rows.forEach(function (s) {
      var id = s.data.slot ? s.data.slot.day : '';
      var g = groups.filter(function (x) {
        return x.id === id;
      })[0];
      if (!g) {
        g = {
          id: id,
          label: 'Slot no longer on the timetable',
          date: '',
          times: [],
          rows: []
        };
        groups.push(g);
      }
      g.rows.push(s);
    });
    return groups.filter(function (g) {
      g.rows.sort(function (a, b) {
        return (
          g.times.indexOf(a.data.slot.time) - g.times.indexOf(b.data.slot.time)
        );
      });
      return g.rows.length;
    });
  };

  /**
   * Orders WhatsApp registrations by group, then by section number.
   *
   * @param {!Array<!Object>} rows The registrations.
   * @return {!Array<!Object>} A sorted copy.
   */
  R.byGroup = function (rows) {
    return rows.slice().sort(function (a, b) {
      var ga = String(a.data.group);
      var gb = String(b.data.group);
      if (ga !== gb) return ga < gb ? -1 : 1;
      return (
        (parseInt(a.data.section, 10) || 0) -
        (parseInt(b.data.section, 10) || 0)
      );
    });
  };

  /**
   * Names the teammates of a booking for the CSV file, or '' when the
   * form does not ask for them.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {string} The members.
   */
  function membersCell(form, s) {
    if (form.type !== FormType.RESERVATION) return s.members;
    if (Rules.fieldByRole(form, 'members').enabled === false) return '';
    return (s.data.members || [])
      .map(function (member) {
        return member.name + ' (' + member.code + ')';
      })
      .join('; ');
  }

  /**
   * Gives the rows of the CSV file. Questions the admin added come after
   * the fixed columns, one column each.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The submissions.
   * @return {!Array<!Array<*>>} The head, then a line for each submission.
   */
  R.csvLines = function (form, rows) {
    var added = (form.fields || []).filter(function (fd) {
      return fd.custom;
    });
    var head = CSV_HEAD.concat(
      added.map(function (fd) {
        return fd.label.en;
      })
    );
    return [head].concat(
      rows.map(function (s) {
        return [
          s.ref,
          s.created,
          s.status,
          s.name,
          s.code,
          s.phone,
          s.email,
          s.title,
          s.link,
          R.slotText(form, s.data.slot),
          membersCell(form, s)
        ].concat(
          added.map(function (fd) {
            return s.data[fd.id] == null ? '' : String(s.data[fd.id]);
          })
        );
      })
    );
  };
})(window.App);
