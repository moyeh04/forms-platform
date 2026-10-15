/**
 * The questions of a form and the pages that hold them, as the Questions
 * tab changes them, shared by its parts as `A.questions`. Nothing here
 * draws: the views call these and draw the list again.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Q = {};
  A.questions = Q;

  /** Questions the form cannot work without: they are always asked. */
  var LOCKED_ROLES = ['name', 'code', 'team_size', 'members', 'slot'];

  /**
   * Questions that belong to a page for a reason: the member forms follow
   * the size, and a booking is its own page.
   */
  var FIXED_ROLES = ['team_size', 'members', 'slot'];

  /** A new id: a prefix and eight letters or digits. */
  var ID = { RADIX: 36, FROM: 2, TO: 10 };

  /**
   * What a question takes, in the words of the page. The kinds an added
   * question can be are read from here.
   */
  Q.TYPE_NAMES = {
    text: 'Short answer',
    textarea: 'Long answer',
    select: 'One choice from a list',
    english_text: 'English text',
    email: 'Email address',
    phone: 'Phone number',
    code: 'Student code',
    drive_link: 'Drive link',
    team_size: 'Team size',
    members: 'Team members',
    slot: 'Time slot'
  };

  /** The kinds an added question can be, as select options. */
  Q.KINDS = ['text', 'textarea', 'select'].map(function (k) {
    return [k, Q.TYPE_NAMES[k]];
  });

  /**
   * Makes a new id.
   *
   * @param {string} prefix 'q_' for a question, 'p_' for a page.
   * @return {string} The id.
   */
  function newId(prefix) {
    return prefix + Math.random().toString(ID.RADIX).slice(ID.FROM, ID.TO);
  }

  /**
   * Tells whether a question is always asked.
   *
   * @param {!Object} fd The question.
   * @return {boolean} True when it has no Show and Required switches.
   */
  Q.isLocked = function (fd) {
    return LOCKED_ROLES.indexOf(fd.role) !== -1;
  };

  /**
   * Names the kind of answer a question takes.
   *
   * @param {!Object} fd The question.
   * @return {string} The name.
   */
  Q.typeName = function (fd) {
    return Q.TYPE_NAMES[fd.type] || fd.type.replace(/_/g, ' ');
  };

  /**
   * Tells whether a question has a description in either language.
   *
   * @param {!Object} fd The question.
   * @return {boolean} True when it has one.
   */
  Q.hasHelp = function (fd) {
    return !!(fd.help?.en || '').trim() || !!(fd.help?.ar || '').trim();
  };

  /**
   * Names a page.
   *
   * @param {!Object} st The page.
   * @return {string} Its title, or a placeholder.
   */
  Q.pageName = function (st) {
    return st.title?.en || st.title?.ar || 'Page with no title';
  };

  /**
   * Finds the page a question is on.
   *
   * @param {!Object} f The form.
   * @param {!Object} fd The question.
   * @return {?Object} The page, or null.
   */
  Q.pageOf = function (f, fd) {
    return (
      (f.steps || []).filter(function (st) {
        return (st.fields || []).indexOf(fd.id) !== -1;
      })[0] || null
    );
  };

  /**
   * Tells whether a question can be moved: it is on a page, there is
   * another page, and it does not belong to its page for a reason.
   *
   * @param {!Object} f The form.
   * @param {!Object} fd The question.
   * @return {boolean} True when it can be moved.
   */
  Q.isMovable = function (f, fd) {
    return (
      FIXED_ROLES.indexOf(fd.role) === -1 &&
      (f.steps || []).length > 1 &&
      !!Q.pageOf(f, fd)
    );
  };

  /**
   * Moves a question to the end of another page.
   *
   * @param {!Object} f The form, changed in place.
   * @param {!Object} fd The question.
   * @param {string} id The page.
   */
  Q.moveToPage = function (f, fd, id) {
    var from = Q.pageOf(f, fd);
    if (from) {
      from.fields = from.fields.filter(function (x) {
        return x !== fd.id;
      });
    }
    var to = f.steps.filter(function (st) {
      return st.id === id;
    })[0];
    to.fields = (to.fields || []).concat([fd.id]);
  };

  /**
   * Moves a question up or down on its page.
   *
   * @param {!Object} f The form, changed in place.
   * @param {!Object} fd The question.
   * @param {number} by -1 for up, 1 for down.
   * @return {boolean} False when it is already at that end.
   */
  Q.shift = function (f, fd, by) {
    var list = Q.pageOf(f, fd).fields;
    var at = list.indexOf(fd.id);
    var to = at + by;
    if (to < 0 || to >= list.length) return false;
    list.splice(at, 1);
    list.splice(to, 0, fd.id);
    return true;
  };

  /**
   * Adds an empty short-answer question to the end of a page.
   *
   * @param {!Object} f The form, changed in place.
   * @param {!Object} st The page.
   * @return {string} The id of the question.
   */
  Q.addQuestion = function (f, st) {
    var id = newId('q_');
    f.fields.push({
      id: id,
      type: 'text',
      custom: true,
      label: { en: '', ar: '' },
      required: false,
      enabled: true
    });
    st.fields = (st.fields || []).concat([id]);
    return id;
  };

  /**
   * Removes a question from the form and from its page.
   *
   * @param {!Object} f The form, changed in place.
   * @param {!Object} fd The question.
   */
  Q.removeQuestion = function (f, fd) {
    f.fields = f.fields.filter(function (x) {
      return x !== fd;
    });
    (f.steps || []).forEach(function (st) {
      st.fields = (st.fields || []).filter(function (x) {
        return x !== fd.id;
      });
    });
  };

  /**
   * Adds an empty page at the end.
   *
   * @param {!Object} f The form, changed in place.
   * @return {!Object} The page.
   */
  Q.addPage = function (f) {
    var st = {
      id: newId('p_'),
      custom: true,
      title: { en: '', ar: '' },
      fields: []
    };
    f.steps = (f.steps || []).concat([st]);
    return st;
  };

  /**
   * Reads the choices of a question: "Yes" or "Yes | نعم" on each line.
   *
   * @param {string} text The lines.
   * @return {!Array<!Object>} The options.
   */
  Q.readChoices = function (text) {
    return String(text || '')
      .split('\n')
      .map(function (line) {
        var parts = line.split('|').map(function (x) {
          return x.trim();
        });
        if (!parts[0]) return null;
        return {
          value: parts[0],
          label: { en: parts[0], ar: parts[1] || parts[0] }
        };
      })
      .filter(Boolean);
  };

  /**
   * Writes the choices of a question back as lines, the way readChoices
   * reads them.
   *
   * @param {?Array<!Object>} options The options.
   * @return {string} The lines.
   */
  Q.choicesText = function (options) {
    return (options || [])
      .map(function (o) {
        return o.label.ar && o.label.ar !== o.label.en
          ? o.label.en + ' | ' + o.label.ar
          : o.label.en;
      })
      .join('\n');
  };

  /**
   * Lists the questions of the Questions tab. The teammates of a booking
   * have their own panel.
   *
   * @param {!Object} s The settings page: `f` and `isReservation`.
   * @return {!Array<!Object>} The questions.
   */
  Q.listed = function (s) {
    return (s.f.fields || []).filter(function (fd) {
      return !(s.isReservation && fd.role === 'members');
    });
  };

  /**
   * Gives the folded line of the Questions panel.
   *
   * @param {!Object} s The settings page.
   * @return {string} How many questions are shown and hidden.
   */
  Q.summary = function (s) {
    var all = Q.listed(s);
    var hidden = all.filter(function (fd) {
      return fd.enabled === false;
    }).length;
    return (
      all.length - hidden + ' shown' + (hidden ? ', ' + hidden + ' hidden' : '')
    );
  };

  /**
   * Tells whether a text is empty in both languages.
   *
   * @param {!Object} t The text: `en` and `ar`.
   * @return {boolean} True when both are empty.
   */
  function blank(t) {
    return !(t.en || '').trim() && !(t.ar || '').trim();
  }

  /**
   * Gives the first thing in the questions that stops a save.
   *
   * @param {!Object} f The form.
   * @return {string} The reason, or ''.
   */
  Q.problem = function (f) {
    var untitled = (f.steps || []).some(function (st) {
      return blank(st.title);
    });
    if (untitled) return 'Give every page a title, or remove the page.';
    var added = (f.fields || []).filter(function (fd) {
      return fd.custom;
    });
    var unwritten = added.some(function (fd) {
      return blank(fd.label);
    });
    if (unwritten) {
      return 'Write the question for every question you added, or remove it.';
    }
    var few = added.filter(function (fd) {
      return fd.type === 'select' && (fd.options || []).length < 2;
    })[0];
    if (few) {
      return (
        '"' + (few.label.en || few.label.ar) + '" needs at least two choices.'
      );
    }
    return '';
  };
})(window.App);
