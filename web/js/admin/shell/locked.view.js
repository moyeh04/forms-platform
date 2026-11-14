/**
 * The screen a browser meets when the shared lock refuses its PIN: a
 * welcome that opens like the dashboard, then the message set from the
 * sheet, a picture and the time left. It shows no form and no answer,
 * since the lock means the PIN was never given.
 */
(function (App) {
  "use strict";

  var A = App.admin;
  var h = App.ui.h;

  /** The milliseconds in a second, the step of a countdown. */
  var MS_PER_SECOND = 1000;

  /** The picture as base64 text, fetched only when the lock screen opens. */
  var IMAGE_SRC = "assets/img/locked-image.txt";

  /** What turns the fetched text into a picture the page can show. */
  var IMAGE_PREFIX = "data:image/webp;base64,";

  /** How the message stands out in the browser console. */
  var CONSOLE_STYLE = "font-weight: bold; font-size: 1.25em;";

  /** A time inside a message, as the backend writes it. */
  var CLOCK_RE = /\d\d:\d\d:\d\d/;

  /** The padding that gives a number two digits. */
  var TWO_DIGITS = "00";

  /** The fetch of the picture, once it has started. */
  var imageLoad = null;

  /**
   * Writes a number with two digits.
   *
   * @param {number} n The number, below 100.
   * @return {string} The digits.
   */
  function two(n) {
    return (TWO_DIGITS + n).slice(-2);
  }

  /**
   * Writes seconds as hours, minutes and seconds, as the backend does.
   *
   * @param {number} seconds The seconds.
   * @return {string} The time, as `00:29:58`.
   */
  function clockText(seconds) {
    var m = Math.floor(seconds / 60);
    return two(Math.floor(m / 60)) + ":" + two(m % 60) + ":" + two(seconds % 60);
  }

  /**
   * Finds when a lock ends, from the time left it was answered with.
   *
   * @param {!Error} error The `locked` or `device_locked` error.
   * @return {number} The end, in milliseconds.
   */
  A.lockEnd = function (error) {
    var seconds = Number(error.details?.seconds) || 0;
    return Date.now() + seconds * MS_PER_SECOND;
  };

  /**
   * Keeps a time left up to date on screen, measured from the clock so a
   * slow tab does not drift. It stops at zero, when the node leaves the
   * page, or when told to.
   *
   * @param {!Element} node Where the text goes.
   * @param {number} endMs When the time runs out.
   * @param {function(string): string} text Builds the text from the time.
   * @return {function()} Stops the countdown.
   */
  A.countdown = function (node, endMs, text) {
    var timer = 0;
    /** Writes the time left and books the next second. */
    function tick() {
      var left = Math.max(0, Math.ceil((endMs - Date.now()) / MS_PER_SECOND));
      node.textContent = text(clockText(left));
      if (left > 0 && node.isConnected) timer = setTimeout(tick, MS_PER_SECOND);
    }
    tick();
    return function () {
      clearTimeout(timer);
    };
  };

  /**
   * Puts the live time into a message that names the time left.
   *
   * @param {string} message The message, with a time such as `00:30:00`.
   * @return {function(string): string} The message with a given time.
   */
  A.withClock = function (message) {
    return function (time) {
      return message.replace(CLOCK_RE, time);
    };
  };

  /**
   * Fetches the picture once. Without it the screen still works: the
   * picture is left out.
   *
   * @return {!Promise<string>} The picture's data URL, or ''.
   */
  function loadImage() {
    imageLoad =
      imageLoad ||
      fetch(IMAGE_SRC)
        .then(function (res) {
          return res.ok ? res.text() : "";
        })
        .then(function (text) {
          return text ? IMAGE_PREFIX + text.trim() : "";
        })
        .catch(function () {
          imageLoad = null;
          return "";
        });
    return imageLoad;
  }

  /**
   * Draws the picture, the message and the time left.
   *
   * @param {!Error} error The `locked` error.
   * @param {function()} close Closes the screen.
   * @return {{lines: !Array<!Element>, time: !Element,
   *     sorry: !Array<!Element>}} The lines to show, the time to count
   *     down and the two buttons.
   */
  function messageLines(error, close) {
    var img = h("img", { class: "locked-image t-stagger-line", alt: "" });
    img.hidden = true;
    loadImage().then(function (src) {
      if (!src) return;
      img.src = src;
      img.hidden = false;
    });
    var time = h("p", {
      class: "locked-time t-stagger-line t-stagger-line--2",
    });
    var said = error.message.split(/\n\s*\n/).map(function (part) {
      var cls = "locked-message t-stagger-line t-stagger-line--2";
      return h("p", { class: cls }, part.trim());
    });
    var sorry = ["Sorry", "Sorry"].map(function (label, i) {
      var cls = i ? "btn btn-quiet" : "btn btn-primary";
      return h("button", { type: "button", class: cls, onclick: close }, label);
    });
    var actions = h("div", { class: "dialog-actions t-stagger-line locked-late" }, sorry);
    return { lines: [img].concat(said, [time, actions]), time, sorry };
  }

  /**
   * Draws the empty modal of the lock screen.
   *
   * @return {{overlay: !Element, box: !Element, body: !Element}} The
   *     backdrop, the modal and the body its lines go in.
   */
  function frame() {
    var body = h("div", { class: "t-stagger" });
    var box = h(
      "div",
      {
        class: "dialog locked t-modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "locked-title",
      },
      body,
    );
    return { overlay: h("div", { class: "overlay" }, box), box, body };
  }

  /**
   * Puts new lines in the modal and reveals them one after another.
   *
   * @param {!Element} body The modal's body.
   * @param {!Array<!Element>} lines The lines.
   */
  function show(body, lines) {
    body.classList.remove("is-shown");
    body.replaceChildren.apply(body, lines);
    void body.offsetWidth;
    body.classList.add("is-shown");
  }

  /**
   * Makes what closes the lock screen, by a button or by Escape, and
   * returns to the PIN with it selected.
   *
   * @param {{overlay: !Element, box: !Element}} ui The modal.
   * @param {!HTMLInputElement} back The PIN field.
   * @return {function()} Closes the screen.
   */
  function closer(ui, back) {
    var root = getComputedStyle(document.documentElement);
    var closeMs = parseFloat(root.getPropertyValue("--modal-close-dur")) || 0;
    /** Closes the screen once its closing motion has played. */
    function close() {
      document.removeEventListener("keydown", onKey);
      ui.box.classList.remove("is-open");
      ui.box.classList.add("is-closing");
      if (closeMs) setTimeout(ui.overlay.remove.bind(ui.overlay), closeMs);
      else ui.overlay.remove();
      back.focus();
      back.select();
    }
    /**
     * Closes on Escape.
     *
     * @param {!KeyboardEvent} e The key pressed.
     */
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return close;
  }

  /**
   * Replaces the welcome with the picture, the message and the time left.
   *
   * @param {!Error} error The `locked` error.
   * @param {!Element} body The modal's body.
   * @param {function()} close Closes the screen.
   */
  function reveal(error, body, close) {
    var parts = messageLines(error, close);
    show(body, parts.lines);
    A.countdown(parts.time, A.lockEnd(error), function (t) {
      return "Time left " + t;
    });
    parts.sorry[0].focus();
  }

  /**
   * Opens the lock screen over the PIN screen and logs its message to the
   * console. Either button, or Escape, closes it and returns to the PIN.
   *
   * @param {!Error} error The `locked` error, its message set from the
   *     sheet and its details carrying the seconds left.
   * @param {!HTMLInputElement} back The PIN field to return to.
   */
  A.lockedView = function (error, back) {
    var ui = frame();
    var close = closer(ui, back);
    var go = h(
      "button",
      {
        type: "button",
        class: "btn btn-primary",
        onclick: reveal.bind(null, error, ui.body, close),
      },
      "Continue to the dashboard",
    );
    console.log("%c" + error.message, CONSOLE_STYLE);
    loadImage();
    show(ui.body, [
      h("h2", { class: "dialog-title t-stagger-line", id: "locked-title" }, "Welcome, funny kid"),
      h("div", { class: "dialog-actions t-stagger-line locked-late" }, go),
    ]);
    document.body.appendChild(ui.overlay);
    void ui.box.offsetWidth;
    ui.box.classList.add("is-open");
    go.focus();
  };
})(window.App);
