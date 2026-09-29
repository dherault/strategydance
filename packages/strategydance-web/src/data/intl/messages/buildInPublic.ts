import { defineMessages } from 'react-intl'

/*
  The build in public page: cards drawn from the reader's streak, priorities, tasks, checklist, log
  and company, what each lets them change, and the images they copy or download of them. What a
  card says is posted as a picture, so it reads to people who have never seen the app
*/
const buildInPublicMessages = defineMessages({
  eyebrow: {
    id: 'buildInPublic.eyebrow',
    defaultMessage: 'Share your progress',
    description: 'Small uppercase line above the title of the build in public page.',
  },
  lead: {
    id: 'buildInPublic.lead',
    defaultMessage:
      'Cards made from your streak, top priority, tasks, checklist, log and company profile. Share them on X or wherever you post updates.',
    description:
      'Line under the title of the build in public page, which turns what the reader does into images to post on social networks.',
  },
  retry: {
    id: 'buildInPublic.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads a section of the build in public page again after it failed to load.',
  },
  caption: {
    id: 'buildInPublic.caption',
    defaultMessage: '{card} · {ratio}',
    description:
      'Caption under a card on the build in public page: its name, then its aspect ratio, such as "Flame · 1:1".',
  },
  customize: {
    id: 'buildInPublic.customize',
    defaultMessage: 'Customize the {card} card',
    description:
      'Accessible name of the group of settings beside a card on the build in public page. {card} is its name, such as "Flame".',
  },
  upTo: {
    id: 'buildInPublic.upTo',
    defaultMessage: 'Up to {count}',
    description: 'Hint under a setting of a card that lets the reader pick several options, at most {count}.',
  },
  copyImage: {
    id: 'buildInPublic.copyImage',
    defaultMessage: 'Copy image',
    description: 'Button beside a card that copies it to the clipboard as a picture.',
  },
  copyImageLabel: {
    id: 'buildInPublic.copyImageLabel',
    defaultMessage: 'Copy the {card} card as an image',
    description: 'Accessible label of the button that copies a card as a picture. {card} is its name.',
  },
  downloadImage: {
    id: 'buildInPublic.downloadImage',
    defaultMessage: 'Download PNG',
    description: 'Button beside a card that downloads it as a PNG picture.',
  },
  downloadImageLabel: {
    id: 'buildInPublic.downloadImageLabel',
    defaultMessage: 'Download the {card} card as an image',
    description: 'Accessible label of the button that downloads a card as a picture. {card} is its name.',
  },
  imageCopied: {
    id: 'buildInPublic.imageCopied',
    defaultMessage: 'Image copied to clipboard',
    description: 'Confirmation shown after a card was copied to the clipboard as a picture.',
  },
  imageDownloaded: {
    id: 'buildInPublic.imageDownloaded',
    defaultMessage: 'Image downloaded',
    description: 'Confirmation shown after a card was downloaded as a picture.',
  },
  imageFailed: {
    id: 'buildInPublic.imageFailed',
    defaultMessage: 'Could not create the image',
    description: 'Error shown when a card could not be turned into a picture to download.',
  },
  copyFailed: {
    id: 'buildInPublic.copyFailed',
    defaultMessage: 'Could not copy the image. Download it instead.',
    description: 'Error shown when a card could not be copied to the clipboard as a picture.',
  },
  copyUnsupported: {
    id: 'buildInPublic.copyUnsupported',
    defaultMessage: 'Your browser cannot copy images. Download it instead.',
    description: "Error shown when the reader's browser has no way to put a picture on the clipboard.",
  },
  background: {
    id: 'buildInPublic.background',
    defaultMessage: 'Background',
    description: 'Label of the setting that picks what every card is drawn on.',
  },
  toneAccent: {
    id: 'buildInPublic.toneAccent',
    defaultMessage: 'Accent',
    description: "Option of a card's background: the accent color itself.",
  },
  toneTint: {
    id: 'buildInPublic.toneTint',
    defaultMessage: 'Light accent',
    description: "Option of a card's background: a light tint of the accent color.",
  },
  toneWhite: {
    id: 'buildInPublic.toneWhite',
    defaultMessage: 'White',
    description: "Option of a card's background.",
  },
  toneNeutral: {
    id: 'buildInPublic.toneNeutral',
    defaultMessage: 'Light gray',
    description: "Option of a card's background.",
  },
  accentColor: {
    id: 'buildInPublic.accentColor',
    defaultMessage: 'Accent color',
    description: "Label of the setting that picks every card's accent color.",
  },
  companyColor: {
    id: 'buildInPublic.companyColor',
    defaultMessage: 'Company color',
    description: "Option of a card's accent or flame color: the color the organization chose on its profile.",
  },
  colorBlue: {
    id: 'buildInPublic.colorBlue',
    defaultMessage: 'Blue',
    description: "Option of a card's accent color.",
  },
  colorSky: {
    id: 'buildInPublic.colorSky',
    defaultMessage: 'Sky',
    description: "Option of a card's accent color: a light, bright blue.",
  },
  colorNavy: {
    id: 'buildInPublic.colorNavy',
    defaultMessage: 'Navy',
    description: "Option of a card's background or accent color: a very dark blue.",
  },
  colorIndigo: {
    id: 'buildInPublic.colorIndigo',
    defaultMessage: 'Indigo',
    description: "Option of a card's accent color.",
  },
  colorViolet: {
    id: 'buildInPublic.colorViolet',
    defaultMessage: 'Violet',
    description: "Option of a card's accent color.",
  },
  colorFuchsia: {
    id: 'buildInPublic.colorFuchsia',
    defaultMessage: 'Fuchsia',
    description: "Option of a card's accent color: a bright purplish pink.",
  },
  colorPink: {
    id: 'buildInPublic.colorPink',
    defaultMessage: 'Pink',
    description: "Option of a card's accent color.",
  },
  colorRed: {
    id: 'buildInPublic.colorRed',
    defaultMessage: 'Red',
    description: "Option of a card's accent color.",
  },
  colorOrange: {
    id: 'buildInPublic.colorOrange',
    defaultMessage: 'Orange',
    description: "Option of a card's accent color.",
  },
  colorAmber: {
    id: 'buildInPublic.colorAmber',
    defaultMessage: 'Amber',
    description: "Option of a card's accent color: a golden yellow.",
  },
  colorLime: {
    id: 'buildInPublic.colorLime',
    defaultMessage: 'Lime',
    description: "Option of a card's accent color: a yellowish green.",
  },
  colorGreen: {
    id: 'buildInPublic.colorGreen',
    defaultMessage: 'Green',
    description: "Option of a card's accent color.",
  },
  colorTeal: {
    id: 'buildInPublic.colorTeal',
    defaultMessage: 'Teal',
    description: "Option of a card's accent color: a blue green.",
  },
  colorGraphite: {
    id: 'buildInPublic.colorGraphite',
    defaultMessage: 'Graphite',
    description: "Option of a card's accent color: a dark gray.",
  },
  colorBlack: {
    id: 'buildInPublic.colorBlack',
    defaultMessage: 'Black',
    description: "Option of a card's accent color.",
  },
  buildingInPublic: {
    id: 'buildInPublic.buildingInPublic',
    defaultMessage: 'Building {organization} in public',
    description:
      'Line at the top of a card, naming the organization the reader works on openly. Written on the picture they post.',
  },
  streakTitle: {
    id: 'buildInPublic.streakTitle',
    defaultMessage: 'Streak',
    description: 'Title of the section of cards about how many days in a row the reader has been active.',
  },
  streakDescription: {
    id: 'buildInPublic.streakDescription',
    defaultMessage: 'Days in a row with at least one update',
    description:
      'Line under the title of the streak section. A day counts when the reader changed their priority, tasks, checklist or log.',
  },
  streakLoadFailed: {
    id: 'buildInPublic.streakLoadFailed',
    defaultMessage: 'Your streak could not be loaded.',
    description: 'Error shown in place of the streak cards when the days the reader was active failed to load.',
  },
  flameCard: {
    id: 'buildInPublic.flameCard',
    defaultMessage: 'Flame',
    description: 'Name of the square card showing the streak beside a big flame.',
  },
  weekCard: {
    id: 'buildInPublic.weekCard',
    defaultMessage: 'This week',
    description: 'Name of the wide card showing the streak and each day of the current week.',
  },
  posterCard: {
    id: 'buildInPublic.posterCard',
    defaultMessage: 'Poster',
    description: 'Name of the tall card showing the streak under a big flame, with who the reader is.',
  },
  calendarCard: {
    id: 'buildInPublic.calendarCard',
    defaultMessage: 'Calendar',
    description: 'Name of the square card showing the streak over the last five weeks, day by day.',
  },
  flameColor: {
    id: 'buildInPublic.flameColor',
    defaultMessage: 'Flame color',
    description: 'Label of the setting that picks the color of the flames on the streak cards.',
  },
  flameWarm: {
    id: 'buildInPublic.flameWarm',
    defaultMessage: 'Warm',
    description: 'Option of the flame color: the reds and yellows of a real flame, rather than the accent color.',
  },
  dayStreak: {
    id: 'buildInPublic.dayStreak',
    defaultMessage: '{count, plural, one {day streak} other {day streak}}',
    description:
      'Words under the big number of days in a row the reader has been active, as in "12 day streak". The number is drawn apart.',
  },
  daysInARow: {
    id: 'buildInPublic.daysInARow',
    defaultMessage: '{count, plural, one {Day in a row} other {Days in a row}}',
    description: 'Uppercase words under the big number of days in a row the reader has been active.',
  },
  streakDays: {
    id: 'buildInPublic.streakDays',
    defaultMessage: '{count, plural, one {#-day streak} other {#-day streak}}',
    description: 'Heading of the calendar card: how many days in a row the reader has been active.',
  },
  thisWeek: {
    id: 'buildInPublic.thisWeek',
    defaultMessage: 'This week · {range}',
    description: 'Uppercase line on the week card, then the dates the week runs over, such as "Sep 28 – Oct 4".',
  },
  bestStreak: {
    id: 'buildInPublic.bestStreak',
    defaultMessage: 'Best streak',
    description: 'Label over the longest run of active days in a row the reader ever had.',
  },
  activeDays: {
    id: 'buildInPublic.activeDays',
    defaultMessage: 'Active days',
    description: 'Label over how many of the last days the reader was active on.',
  },
  days: {
    id: 'buildInPublic.days',
    defaultMessage: '{count, plural, one {# day} other {# days}}',
    description: 'A number of days, as in "14 days".',
  },
  activeDaysCount: {
    id: 'buildInPublic.activeDaysCount',
    defaultMessage: '{count} of {total}',
    description: 'How many of the last {total} days the reader was active on, as in "18 of 30".',
  },
  priorityTitle: {
    id: 'buildInPublic.priorityTitle',
    defaultMessage: 'Top priority',
    description: 'Title of the section of cards showing the one thing the reader, or a teammate, is moving forward.',
  },
  priorityDescription: {
    id: 'buildInPublic.priorityDescription',
    defaultMessage: 'What you are focused on today',
    description: 'Line under the title of the top priority section.',
  },
  teamLoadFailed: {
    id: 'buildInPublic.teamLoadFailed',
    defaultMessage: 'Your team could not be loaded.',
    description: "Error shown in place of the top priority cards when the team's priorities failed to load.",
  },
  focusCard: {
    id: 'buildInPublic.focusCard',
    defaultMessage: 'Date and focus',
    description: "Name of the wide card showing today's date beside somebody's top priority.",
  },
  statementCard: {
    id: 'buildInPublic.statementCard',
    defaultMessage: 'Bold statement',
    description: "Name of the square card showing somebody's top priority in large type.",
  },
  oneThingCard: {
    id: 'buildInPublic.oneThingCard',
    defaultMessage: 'One thing',
    description: "Name of the tall card showing somebody's top priority as the one thing they do today.",
  },
  teammate: {
    id: 'buildInPublic.teammate',
    defaultMessage: 'Teammate',
    description: 'Label of the setting that picks whose priority or log a card shows.',
  },
  focusedOn: {
    id: 'buildInPublic.focusedOn',
    defaultMessage: "Today I'm focused on",
    description: "Uppercase line above somebody's top priority, written as they would say it.",
  },
  priorityOn: {
    id: 'buildInPublic.priorityOn',
    defaultMessage: 'Top priority · {date}',
    description: 'Uppercase line above somebody\'s top priority, then today\'s date, such as "Sep 29".',
  },
  oneThingToday: {
    id: 'buildInPublic.oneThingToday',
    defaultMessage: 'One thing today',
    description: "Uppercase line above somebody's top priority, the one thing they move forward today.",
  },
  setPriority: {
    id: 'buildInPublic.setPriority',
    defaultMessage: 'Set your top priority on the Today page',
    description: "Shown on a card in place of the reader's top priority while they have none.",
  },
  noPriority: {
    id: 'buildInPublic.noPriority',
    defaultMessage: 'No top priority set yet',
    description: "Shown on a card in place of a teammate's top priority while they have none.",
  },
})

export default buildInPublicMessages
