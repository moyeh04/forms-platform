/** The slots of a reservation form: cleaned, labelled and counted. */

var SlotsRules = (function () {
  /** The length of a slot, in minutes, when the pattern does not say. */
  var DEFAULT_SLOT_MINUTES_ = 20;

  /** What a time of the slot pattern looks like, such as `9:30`. */
  var CLOCK_TIME_ = /^\d{1,2}:\d{2}$/;

  /** What a date of a day looks like. */
  var ISO_DATE_ = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Cleans the times of a day: spaces made single, empty and repeated times
   * dropped.
   *
   * @param {?Array<*>} times The times as typed.
   * @return {!Array<string>} The times.
   */
  function cleanTimes_(times) {
    var out = [];
    (times || []).forEach(function (t) {
      t = String(t).replace(/\s+/g, ' ').trim();
      if (t && out.indexOf(t) === -1) out.push(t);
    });
    return out;
  }

  /**
   * Cleans one day of the timetable and gives it an id no other day has.
   *
   * @param {!Object} d The day as typed.
   * @param {!Object<string, boolean>} seen The ids given so far, changed in
   *     place.
   * @return {{id: string, label: string, date: string, times: !Array}} The
   *     day.
   * @throws {ApiError} `bad_slots` for a day with no name, a bad date or no
   *     times.
   */
  function cleanDay_(d, seen) {
    var label = String(d.label || '').trim();
    if (!label)
      ApiError.fail(
        'bad_slots',
        'Every day needs a name, for example "Week 11 - Sunday".'
      );
    var id = Text.slugify(d.id || label);
    var base = id;
    var n = 2;
    while (seen[id]) id = base + '-' + n++;
    seen[id] = true;
    var date = String(d.date || '').trim();
    if (date && !ISO_DATE_.test(date))
      ApiError.fail('bad_slots', 'Dates must look like 2027-11-14.');
    var times = cleanTimes_(d.times);
    if (!times.length)
      ApiError.fail('bad_slots', '"' + label + '" has no time slots.');
    return { id: id, label: label, date: date, times: times };
  }

  /**
   * Cleans the pattern the timetable was made with.
   *
   * @param {?Object} p The pattern as saved.
   * @return {?Object} The pattern, or null when it has no valid start and
   *     end.
   */
  function cleanPattern_(p) {
    if (!p || !CLOCK_TIME_.test(String(p.start))) return null;
    if (!CLOCK_TIME_.test(String(p.end))) return null;
    return {
      start: String(p.start),
      end: String(p.end),
      length: Math.max(1, parseInt(p.length, 10) || DEFAULT_SLOT_MINUTES_),
      gap: Math.max(0, parseInt(p.gap, 10) || 0)
    };
  }

  /**
   * Cleans the slot configuration an admin saves.
   *
   * @param {?Object} slots The days, capacity and pattern as saved.
   * @return {!Object} The cleaned configuration.
   * @throws {ApiError} `bad_slots` for a day that is not right.
   */
  function normalizeSlots_(slots) {
    var capacity = parseInt(slots?.capacity, 10);
    if (!(capacity >= 1)) capacity = 1;
    var seen = {};
    var result = {
      days: (slots?.days || []).map(function (d) {
        return cleanDay_(d, seen);
      }),
      capacity: capacity
    };
    var pattern = cleanPattern_(slots?.pattern);
    if (pattern) result.pattern = pattern;
    return result;
  }

  /**
   * Counts the bookings of each slot. No personal data.
   *
   * @param {!Object} form The form.
   * @return {!Object<string, number>} The count by `day|time` key.
   */
  function slotAvailability_(form) {
    var taken = {};
    ResponsesRepository.readResponses(form).forEach(function (r) {
      if (r.slot) taken[r.slot] = (taken[r.slot] || 0) + 1;
    });
    return taken;
  }

  /**
   * Splits a slot key into its day and time.
   *
   * @param {!Object} form The form.
   * @param {*} key The key, `day|time`.
   * @return {{dayId: string, time: string, day: ?Object}} The parts, with
   *     the day of the form or null when it is gone.
   */
  function slotParts_(form, key) {
    var parts = String(key).split('|');
    var day = (form.slots?.days || []).filter(function (d) {
      return d.id === parts[0];
    })[0];
    return {
      dayId: parts[0],
      time: parts.slice(1).join('|'),
      day: day || null
    };
  }

  return {
    slotParts: slotParts_,
    slotAvailability: slotAvailability_,
    normalizeSlots: normalizeSlots_
  };
})();
