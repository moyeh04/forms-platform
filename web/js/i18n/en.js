/** The English text of the student page, by key. */
(function (App) {
  'use strict';

  App.strings = App.strings || {};
  App.strings.en = {
    loading: 'Opening the form...',
    notFound: 'This form does not exist. Check the link and try again.',
    connError:
      'Could not reach the server. Check your connection and try again.',
    retry: 'Try again',
    closed: 'This form is closed.',
    notYet: 'This form has not opened yet.',
    draft: 'This form is not available yet.',
    next: 'Next',
    back: 'Back',
    submit: 'Submit registration',
    book: 'Confirm booking',
    submitting: 'Sending...',
    stepOf: 'Step {n} of {total}',
    treasure: 'Treasure!',
    reviewStep: 'Review',
    reviewTitle: 'Check your details',
    reviewHelp: 'Make sure everything is right before you send it.',
    reviewHelpKey:
      'Make sure everything is right. You can still fix it later with your ' +
      'key.',
    optional: 'optional',
    change: 'Change',
    choose: 'Choose...',
    onlyFor: 'For {names} students only',
    and: ' and ',
    folderRule:
      'Name the folder Team_Leader_Name_Project_Name_Subject_Name, like ' +
      '{example}: no spaces, parts joined by underscores.',
    addMember: 'Add a team member',
    removeMember: 'Remove',
    memberN: 'Team member {n}',
    teamSize: 'Team of {n}',
    pickSize: 'Choose the team size above to see the member forms.',
    soloTeam: 'You are registering alone, as a team of one.',
    leader: 'Leader',
    none: 'None',
    slotDay: 'Day',
    slotTime: 'Time',
    slotFull: 'Fully booked',
    slotsLeft: '{n} left',
    slotMove:
      'Your time now, {was}, is given up when you save, and anyone can book ' +
      'it then.',
    slotNone: 'No free slots on this day.',
    slotPick: 'Pick a day to see the times.',
    hintArabic: 'Arabic letters only',
    hintEnglish: 'English letters only',
    hintDigits: 'Digits only',
    fixErrors: 'Fix the highlighted answers to continue.',
    themeToggle: 'Switch light and dark',
    langToggle: 'العربية',
    ticketTitle: 'Registration received',
    ticketRef: 'Reference',
    ticketKey: 'Your key',
    ticketKeyNote:
      'Save this key. You need it to edit or cancel your registration.',
    ticketValid: 'Valid until {date}',
    ticketNoKey: 'Your registration is saved.',
    ticketTeamKey:
      "Your team's key opens this booking, to change its time or cancel it.",
    ticketShot:
      'Take a screenshot of this page now. The key is shown only once.',
    saveImage: 'Save as image',
    savePdf: 'Save as PDF',
    copyKey: 'Copy key',
    copied: 'Copied',
    imageFail: 'Could not make the image. Take a screenshot instead.',
    emailSent: 'A copy was sent to {email}.',
    editLink: 'Already registered? Edit or cancel with your key',
    teamStep: 'Your team',
    teamHelp:
      'Type the 5-digit key you got when you registered in "{form}". Your ' +
      'details are filled in for you.',
    findTeam: 'Find my team',
    teamIs: 'This is your team',
    teamLeader: 'Team leader',
    teamCode: 'Leader code',
    teamProject: 'Project',
    teamPeople: 'Team',
    teamPeopleN: '{n} people',
    teamSolo: 'One person',
    teamMates: 'Teammates',
    otherKey: 'Use another key',
    teamBooked: 'Your team already has a booking.',
    teamBookedAt: 'Your team is booked for {when}.',
    moveTime: 'Change the time',
    editTitle: 'Open your registration',
    editHelp: 'Type the 5-digit key you saved when you registered.',
    editOpen: 'Open my registration',
    keyLabel: 'Your key',
    editing: 'Editing {ref}',
    keyUntil: 'Key valid until {date}',
    done: 'Done',
    undo: 'Undo',
    memberRemoved: 'Team member {n} was removed.',
    yourRegistration: 'Your registration',
    progressTitle: 'Your progress',
    progressStates: {
      not_yet: 'Not yet',
      submitted: 'Submitted',
      discussed: 'Discussed'
    },
    progressNewKey:
      'Your key has ended, so this is read only. Changes need a new key.',
    yourRegistrationHelp:
      'Choose Change next to the part you want to correct. Nothing is saved ' +
      'until you choose Save changes.',
    yourBookingHelp:
      'Only the time of a booking can change. Choose Change next to it. ' +
      'Nothing is saved until you choose Save changes.',
    noChanges: 'Nothing is changed yet.',
    closeEdit: 'Close',
    closeUnsaved: 'Close without saving',
    leaveTitle: 'Close without saving?',
    leaveBody: 'The changes you made are not saved.',
    leaveYes: 'Close',
    leaveNo: 'Keep editing',
    listSep: ', ',
    transferTitle: 'Already in another team',
    transferBody:
      '{list}. You can ask the leader of that team to release them. Your ' +
      'team is saved now without them, and they join it when the leader ' +
      'approves.',
    transferAsk: 'Ask the leader',
    transferNo: 'Go back',
    transferLeaderPhone: 'Leader of team {team}:',
    freshReady: 'A newer version of this page is ready.',
    freshReload: 'Reload',
    copyNumber: 'Copy number',
    copyFail: 'Could not copy. Select the number and copy it.',
    openWhatsapp: 'Open in WhatsApp',
    transferLeads: '(leads that team)',
    transferBodyLeader:
      'A leader who agrees hands their team to one of its members first.',
    transferAlone:
      '{list} cannot be asked for: they lead a team with no other member.',
    transferSent:
      'Request sent: {list}. Your team is registered without them until the ' +
      'leader of that team approves.',
    transferAskedTitle: 'A team asks for one of your members',
    transferAskedBody: 'Team {team} asks for {who} to move to it.',
    transferSizeAfter: 'If you approve, you will be a team of {n}.',
    transferUnderMin:
      'That is under the minimum of {min}; the instructor will be told.',
    transferApprove: 'Approve',
    transferReject: 'Reject',
    transferLater: 'Later',
    transferAnswer: 'Answer',
    transferApproved: '{who} moved to team {team}.',
    transferRejected: '{who} stays on your team.',
    transferStayed: 'You stay on your team.',
    transferAskedYouTitle: 'A team asks for you',
    transferAskedYou: 'Team {team} asks for you to move to it.',
    handoverChoose: 'You lead this team, so choose who leads it after you.',
    handoverAlone:
      'You are the only one in this team, so there is nobody to lead it ' +
      'after you.',
    handoverWho: 'New leader',
    handoverEmail: 'Email of the new leader',
    handoverPick: 'Choose the new leader.',
    handoverSizeAfter: 'After you move, this is a team of {n}.',
    handoverApprove: 'Hand over and move',
    movedTitle: 'You moved to team {team}',
    movedBody:
      '{who} leads team {ref} now. Give them its edit key, {key}. The key ' +
      'did not change, and you no longer need it.',
    transferSaveFirst: 'Save your changes first, then answer the request.',
    transferWaiting: 'Waiting for team {team} to release {who}.',
    transferCancel: 'Cancel request',
    transferJoined: '{who} joined your team.',
    transferKept: 'Team {team} kept {who}.',
    transferElsewhere: '{who} joined another team.',
    saveChanges: 'Save changes',
    cancelReg: 'Cancel registration',
    cancelTitle: 'Cancel this registration?',
    cancelBody: 'Your place is released and you can register again.',
    cancelYes: 'Yes, cancel it',
    cancelNo: 'Keep it',
    cancelledTitle: 'Registration cancelled',
    cancelledBody: 'You can fill in the form again if you need to.',
    savedTitle: 'Changes saved',
    readOnly:
      'Changes are not allowed for this form. You can cancel and register ' +
      'again.',
    deadlineLocked:
      'The deadline has passed, so this task can no longer be changed or ' +
      'cancelled.',
    backToForm: 'Back to the form',
    newRegistration: 'Register again',
    errors: {
      required: 'This field is required.',
      invalid_email: 'Enter a valid email address.',
      arabic_only: 'Use Arabic letters only.',
      arabic_parts: 'Enter at least {min} names, in Arabic.',
      english_only: 'Use English letters only.',
      too_short: 'Write at least {min} characters.',
      too_long: 'Keep it under {max} characters.',
      invalid_phone: 'Enter an Egyptian mobile number, like 01012345678.',
      invalid_code: 'The code is {length} digits.',
      invalid_choice: 'Choose one of the options.',
      invalid_link: 'Paste a Google Drive link.',
      link_kind: 'This link should point to: {kinds}.',
      link_unreachable:
        'This link does not open. Check it and share it with "Anyone with ' +
        'the link".',
      link_not_public:
        'Share this file with "Anyone with the link", then try again.',
      folder_name_spaces:
        'The folder is named "{name}", which has spaces. Rename it in Drive ' +
        'with underscores, like {example}.',
      folder_name_format:
        'The folder is named "{name}". Rename it in Drive as the team ' +
        "leader's name, the project name, and the subject name joined by " +
        'underscores, like {example}.',
      folder_name_subject:
        'The folder name must end with _{subject}. Rename it in Drive, like ' +
        '{example}.',
      invalid_slot: 'Pick a day and a time.',
      too_many_members: 'A team can have {max} extra members at most.',
      too_few_members: 'Add at least {min} team members.',
      invalid_team_size: 'Choose a team size from {min} to {max}.',
      members_count: 'Fill in all {count} team member forms.',
      bad_team_size: 'Team size must be between 1 and 20.',
      members_invalid: 'Check the team members.',
      duplicate_code: 'This code is already in your team.',
      duplicate: 'This code is already registered. Use your key to edit it.',
      duplicate_member:
        'Someone in this team is already registered in another team.',
      transfer_gone: 'This request was already answered.',
      transfer_full: 'The team that asked is full now.',
      transfer_leader: 'This student leads a team alone and cannot be moved.',
      transfer_heir: 'Choose who leads the team after this student.',
      transfer_email: 'Write the email of the new leader.',
      slot_taken: 'That time was just taken. Pick another.',
      form_full: 'This form is full.',
      already_booked:
        'Your team already has a booking. Open it with your key to change ' +
        'its time.',
      key_booking_off: 'This form no longer takes keys. Reload the page.',
      bad_key: 'That key is not right.',
      key_expired:
        'This key has expired. Ask your instructor to extend it, or to make ' +
        'the change for you.',
      too_many_attempts: 'Too many tries. Wait a minute and try again.',
      key_disabled: 'Editing with a key is turned off.',
      edit_disabled: 'Editing is turned off for this form.',
      delete_disabled: 'Cancelling is turned off for this form.',
      form_closed: 'This form is closed.',
      deadline_passed:
        'The deadline has passed, so this task can no longer be changed.',
      form_not_yet: 'This form has not opened yet.',
      form_draft: 'This form is not available yet.',
      busy: 'The server is busy. Try again in a moment.',
      network:
        'Could not reach the server. Check your connection and try again.',
      invalid: 'Some answers need fixing.',
      server_error: 'Something went wrong. Try again.',
      bad_response: 'The server sent an unexpected answer.',
      not_configured: 'The website is not connected to the backend yet.'
    }
  };
})(window.App);
