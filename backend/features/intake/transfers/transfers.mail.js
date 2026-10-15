/** The emails of a transfer request and of its answer. */

var TransfersMail = (function () {
  /** The subject of each kind of email. */
  var SUBJECTS_ = {
    asked: 'A team asks for one of your members',
    leads: 'You now lead your team',
    approved: 'Your request was approved',
    rejected: 'Your request was rejected'
  };

  /**
   * Gives the subject of an email; an unknown kind reads as a rejection.
   *
   * @param {string} kind `asked`, `leads`, `approved` or `rejected`.
   * @return {string} The subject.
   */
  function subjectOf_(kind) {
    return Object.keys(SUBJECTS_).indexOf(kind) === -1
      ? SUBJECTS_.rejected
      : SUBJECTS_[kind];
  }

  /**
   * Finds the email of the leader an email goes to: the team that holds
   * the student for a request or a new lead, the team that asked for an
   * answer.
   *
   * @param {!Object} form The form.
   * @param {!Object} t The request.
   * @param {string} kind `asked`, `leads`, `approved` or `rejected`.
   * @return {*} The email, or nothing when the team has none.
   */
  function recipient_(form, t, kind) {
    var teamId = kind === 'asked' || kind === 'leads' ? t.fromId : t.toId;
    var team = ResponsesRepository.readResponses(form).filter(function (r) {
      return r.id === teamId;
    })[0];
    return team && Rules.valueByRole(form, team.data, 'email');
  }

  /**
   * Writes the lines of an email.
   *
   * @param {!Object} form The form.
   * @param {!Object} t The request.
   * @param {string} kind `asked`, `leads`, `approved` or `rejected`.
   * @return {!Array<string>} The lines.
   */
  function linesOf_(form, t, kind) {
    var who = (t.member.name || '') + ' (' + t.code + ')';
    var link = ResponsesNotify.siteLink(form);
    var tail = link ? ' ' + link : '';
    if (kind === 'asked') {
      return [
        'Team ' +
          t.toRef +
          ' asks for ' +
          who +
          ', who is on your team ' +
          t.fromRef +
          '.',
        '',
        'Open the form with your edit key to approve or reject.' + tail
      ];
    }
    if (kind === 'leads') {
      return [
        'You now lead team ' +
          t.fromRef +
          '. ' +
          who +
          ' led it and moved to team ' +
          t.toRef +
          '.',
        '',
        'Ask them for the edit key of the team; it opens the form for you.' +
          tail
      ];
    }
    if (kind === 'approved') {
      return [who + ' moved to your team ' + t.toRef + '.'];
    }
    return [
      'Team ' +
        t.fromRef +
        ' kept ' +
        who +
        '. Your team ' +
        t.toRef +
        ' stays as it is.'
    ];
  }

  /**
   * Tells the leader who must answer, or the leader who asked, by email.
   * The leaders see requests when they open the form with their key, so an
   * email goes out only when the form switches them on. It never stops the
   * request.
   *
   * @param {!Object} form The form.
   * @param {!Object} t The request.
   * @param {string} kind `asked`, `leads`, `approved` or `rejected`.
   */
  function mailTransfer_(form, t, kind) {
    var to;
    try {
      if (form.rules?.transferEmails !== true) return;
      to = recipient_(form, t, kind);
      if (!to) return;
      MailApp.sendEmail({
        to: to,
        subject: '[' + form.title + '] ' + subjectOf_(kind),
        body: linesOf_(form, t, kind).join('\n')
      });
    } catch (e) {
      Logger.log('Transfer email not sent: ' + e.message);
    }
  }

  /**
   * Sends the emails after an answer: to the leader who asked, and to the
   * new leader of a team that was handed over.
   *
   * @param {!Object} form The form.
   * @param {{transfer: !Object, handed: boolean}} out The answer.
   */
  function mailDecision_(form, out) {
    mailTransfer_(form, out.transfer, out.transfer.status);
    if (out.handed) mailTransfer_(form, out.transfer, 'leads');
  }

  return { mailTransfer: mailTransfer_, mailDecision: mailDecision_ };
})();
