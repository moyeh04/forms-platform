/** The emails of a transfer request and of its answer. */

/** Tells the leader who must answer, or the leader who asked, by email. Never stops the request. */
function mailTransfer_(form, t, kind) {
  try {
    // The leaders see requests when they open the form with their key; email only when switched on.
    if ((form.rules || {}).transferEmails !== true) return;
    var rows = ResponsesRepository.readResponses(form);
    var team = rows.filter(function (r) {
      return (
        r.id === (kind === 'asked' || kind === 'leads' ? t.fromId : t.toId)
      );
    })[0];
    var to = team && Rules.valueByRole(form, team.data, 'email');
    if (!to) return;
    var who = (t.member.name || '') + ' (' + t.code + ')';
    var link = ResponsesNotify.siteLink(form);
    var lines =
      kind === 'asked'
        ? [
            'Team ' +
              t.toRef +
              ' asks for ' +
              who +
              ', who is on your team ' +
              t.fromRef +
              '.',
            '',
            'Open the form with your edit key to approve or reject.' +
              (link ? ' ' + link : '')
          ]
        : kind === 'leads'
          ? [
              'You now lead team ' +
                t.fromRef +
                '. ' +
                who +
                ' led it and moved to team ' +
                t.toRef +
                '.',
              '',
              'Ask them for the edit key of the team; it opens the form for you.' +
                (link ? ' ' + link : '')
            ]
          : kind === 'approved'
            ? [who + ' moved to your team ' + t.toRef + '.']
            : [
                'Team ' +
                  t.fromRef +
                  ' kept ' +
                  who +
                  '. Your team ' +
                  t.toRef +
                  ' stays as it is.'
              ];
    var subject =
      kind === 'asked'
        ? 'A team asks for one of your members'
        : kind === 'leads'
          ? 'You now lead your team'
          : kind === 'approved'
            ? 'Your request was approved'
            : 'Your request was rejected';
    MailApp.sendEmail({
      to: to,
      subject: '[' + form.title + '] ' + subject,
      body: lines.join('\n')
    });
  } catch (e) {
    Logger.log('Transfer email not sent: ' + e.message);
  }
}

/** The emails after an answer: the leader who asked, and the new leader of a team that was handed over. */
function mailDecision_(form, out) {
  mailTransfer_(form, out.transfer, out.transfer.status);
  if (out.handed) mailTransfer_(form, out.transfer, 'leads');
}
