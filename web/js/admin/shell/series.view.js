/**
 * The bookings under a registration form on its card, newest first, and
 * the button that makes the next one.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var toast = App.ui.toast;
  var SIZE = A.ICON_SIZE;

  /** Where the unfolded series are kept for the browser tab. */
  var SERIES_KEY = 'forms.series';

  /**
   * Draws the days a reservation offers. One with no days cannot be
   * booked, so it says so and leads to the timetable.
   *
   * @param {!Object} f The reservation.
   * @return {!Element} The days, or the link to add them.
   */
  A.daysNote = function (f) {
    var days = f.slots?.days || [];
    if (!days.length) {
      return h(
        'a',
        {
          class: 'badge none',
          name: 'no-days',
          href: '#/f/' + encodeURIComponent(f.slug) + '/timetable'
        },
        'No days yet'
      );
    }
    return h(
      'span',
      { class: 'muted-note' },
      days.length === 1
        ? days[0].label
        : days[0].label + ' to ' + days[days.length - 1].label
    );
  };

  /**
   * Reads or keeps whether the bookings of a form are unfolded, for the
   * browser tab. Without storage, they stay folded.
   *
   * @param {string} id The form.
   * @param {boolean=} open The new state; read when absent.
   * @return {boolean} Whether they are unfolded, when read.
   */
  function seriesOpen(id, open) {
    var all;
    try {
      all = JSON.parse(window.sessionStorage.getItem(SERIES_KEY) || '{}');
      if (open === undefined) return !!all[id];
      all[id] = open;
      window.sessionStorage.setItem(SERIES_KEY, JSON.stringify(all));
    } catch {
      // Storage is not available.
    }
    return false;
  }

  /**
   * Makes the next booking of a form and opens its timetable.
   *
   * @param {!Object} f The form whose keys open the booking.
   * @param {string} title The title of the first booking; the next ones
   *     are numbered from the last.
   * @param {?Element=} btn The button pressed.
   * @return {!Promise} Settles when it is made or failed.
   */
  function makeBooking(f, title, btn) {
    return A.busy(btn, async function () {
      var res = await A.call('admin.bookings.next', {
        source: f.id,
        title: title || ''
      });
      var name = '"' + res.form.title + '"';
      toast(
        res.copied
          ? name +
              ' is a copy of the last booking, one week later. Check the' +
              ' days, then set it to Open.'
          : name + ' created as a draft. Add its days, then set it to Open.',
        'ok'
      );
      window.location.hash =
        '#/f/' + encodeURIComponent(res.form.slug) + '/timetable';
    });
  }

  /**
   * Asks for the title of the first booking of a form, then makes it.
   *
   * @param {!Object} f The form.
   */
  function firstBooking(f) {
    var title = 'Discussion - Week 1';

    /**
     * Makes the booking, or refuses an empty title.
     *
     * @return {*} False to keep the dialog open, else the making.
     */
    function create() {
      if (!title.trim()) {
        toast('Give the booking a title.', 'err');
        return false;
      }
      return makeBooking(f, title);
    }

    A.modal(
      'First booking for "' + f.title + '"',
      h(
        'div',
        null,
        h(
          'p',
          { class: 'help' },
          'Teams book a time with the key they got from this form, so they' +
            ' do not type their details again. Later bookings are copied' +
            ' from this one, one week later, and the number in the title' +
            ' goes up.'
        ),
        A.field(
          'Title',
          A.text(
            title,
            function (v) {
              title = v;
            },
            { name: 'booking-title' }
          )
        )
      ),
      [
        { text: 'Cancel', kind: 'quiet' },
        { text: 'Create booking', kind: 'primary', onclick: create }
      ]
    );
  }

  /**
   * Draws the button that makes the next booking, or the first.
   *
   * @param {!Object} f The form.
   * @param {boolean} hasBookings True when it has bookings already.
   * @return {!Element} The button.
   */
  function nextButton(f, hasBookings) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        name: 'next-booking',
        onclick: function (e) {
          if (hasBookings) return makeBooking(f, '', e.currentTarget);
          firstBooking(f);
        }
      },
      icon('plus', SIZE.MENU),
      hasBookings
        ? 'New booking, one week later'
        : 'Add a booking for this form'
    );
  }

  /**
   * Draws a booking in the list under its form.
   *
   * @param {!Object} k The booking.
   * @return {!Element} The line.
   */
  function bookingItem(k) {
    var link = A.formLink(k.slug);
    return h(
      'li',
      { dataset: { booking: k.slug } },
      h(
        'a',
        { class: 'series-title', href: '#/f/' + encodeURIComponent(k.slug) },
        k.title
      ),
      h(
        'span',
        { class: 'series-meta' },
        A.badge(A.STATUS_LABEL[k.status] || k.status, k.status),
        A.daysNote(k)
      ),
      h(
        'span',
        { class: 'series-links' },
        h(
          'a',
          {
            class: 'link-btn',
            href: '#/f/' + encodeURIComponent(k.slug) + '/timetable'
          },
          'Timetable'
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            'aria-label': 'Copy the link of ' + k.title,
            onclick: async function () {
              var copied = await App.ui.copyText(link);
              toast(copied ? 'Booking link copied' : 'Could not copy', 'ok');
            }
          },
          'Copy link'
        )
      )
    );
  }

  /**
   * Draws the head of the folded list: the count and the newest booking.
   *
   * @param {!Object} f The form.
   * @param {!Array<!Object>} kids Its bookings, newest first.
   * @return {!Element} The head.
   */
  function seriesHead(f, kids) {
    return h(
      'summary',
      { name: 'bookings-' + f.slug },
      icon('calendar', SIZE.LINE),
      'Bookings',
      h('span', { class: 'series-count' }, String(kids.length)),
      h(
        'span',
        { class: 'series-latest' },
        kids[0].title,
        A.badge(
          A.STATUS_LABEL[kids[0].status] || kids[0].status,
          kids[0].status
        )
      )
    );
  }

  /**
   * Draws the bookings under a registration form. Bookings made earlier
   * stay listed; a new one is offered only while the form still gives
   * keys. The list is folded until asked for, since a form can have a
   * booking for every week of a term.
   *
   * @param {!Object} f The form.
   * @param {!Array<!Object>} kids Its bookings, newest first.
   * @return {?Element} The bookings, or null when it has none to offer.
   */
  A.series = function (f, kids) {
    if (!kids.length && !(A.issuesKeys(f) && A.hasTeams(f))) return null;
    if (!kids.length) {
      return h('div', { class: 'series' }, nextButton(f, false));
    }
    var box = h(
      'details',
      {
        class: 'series',
        open: seriesOpen(f.id),
        ontoggle: function () {
          seriesOpen(f.id, box.open);
        }
      },
      seriesHead(f, kids),
      h('ul', { class: 'series-list' }, kids.map(bookingItem)),
      A.issuesKeys(f) ? nextButton(f, true) : null
    );
    return box;
  };
})(window.App);
