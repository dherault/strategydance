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
  tasksTitle: {
    id: 'buildInPublic.tasksTitle',
    defaultMessage: 'Tasks',
    description: "Title of the section of cards about the reader's task lists.",
  },
  tasksDescription: {
    id: 'buildInPublic.tasksDescription',
    defaultMessage: 'What you are getting done',
    description: 'Line under the title of the tasks section.',
  },
  tasksLoadFailed: {
    id: 'buildInPublic.tasksLoadFailed',
    defaultMessage: 'Your tasks could not be loaded.',
    description: "Error shown in place of the task cards when the reader's task lists failed to load.",
  },
  progressCard: {
    id: 'buildInPublic.progressCard',
    defaultMessage: 'List progress',
    description: 'Name of the wide card showing how much of one task list is done, and its first tasks.',
  },
  crossedOffCard: {
    id: 'buildInPublic.crossedOffCard',
    defaultMessage: 'Crossed off',
    description: 'Name of the square card counting the tasks the reader has done.',
  },
  upNextCard: {
    id: 'buildInPublic.upNextCard',
    defaultMessage: 'Up next',
    description: 'Name of the tall card listing the next tasks the reader will do on one list.',
  },
  allListsCard: {
    id: 'buildInPublic.allListsCard',
    defaultMessage: 'All lists',
    description: 'Name of the square card showing how much of each task list is done.',
  },
  taskList: {
    id: 'buildInPublic.taskList',
    defaultMessage: 'Task list',
    description: 'Label of the setting that picks which task list a card shows, and the uppercase line above its name.',
  },
  taskLists: {
    id: 'buildInPublic.taskLists',
    defaultMessage: 'Task lists',
    description: 'Label of the setting that picks which task lists a card counts.',
  },
  numberOfTasks: {
    id: 'buildInPublic.numberOfTasks',
    defaultMessage: 'Number of tasks',
    description: 'Label of the setting that picks how many tasks a card lists.',
  },
  tasksOption: {
    id: 'buildInPublic.tasksOption',
    defaultMessage: '{count, plural, one {# task} other {# tasks}}',
    description: 'Option of how many tasks a card lists, as in "3 tasks".',
  },
  tasksDone: {
    id: 'buildInPublic.tasksDone',
    defaultMessage: '{count, plural, one {task done} other {tasks done}}',
    description: 'Words under how many tasks of a list are done, as in "3/8 tasks done". The numbers are drawn apart.',
  },
  moreTasks: {
    id: 'buildInPublic.moreTasks',
    defaultMessage: '{count, plural, one {+# more task} other {+# more tasks}}',
    description: 'Line under the tasks a card lists, saying how many more the list has.',
  },
  tasksCrossedOff: {
    id: 'buildInPublic.tasksCrossedOff',
    defaultMessage: 'Tasks crossed off',
    description: 'Uppercase line above the big number of tasks the reader has done.',
  },
  doneOnList: {
    id: 'buildInPublic.doneOnList',
    defaultMessage: 'done on {list}',
    description:
      'Words under the big number of tasks done, naming the one list they are on, as in "12 done on Launch".',
  },
  doneAcrossLists: {
    id: 'buildInPublic.doneAcrossLists',
    defaultMessage: '{count, plural, one {done across # list} other {done across # lists}}',
    description: 'Words under the big number of tasks done, saying how many lists they are on.',
  },
  upNext: {
    id: 'buildInPublic.upNext',
    defaultMessage: 'Up next',
    description: 'Uppercase line above the name of a task list whose next tasks a card lists.',
  },
  allDone: {
    id: 'buildInPublic.allDone',
    defaultMessage: 'Everything on this list is done.',
    description: 'Shown in place of the next tasks when every task on the list is done.',
  },
  tasksAcrossLists: {
    id: 'buildInPublic.tasksAcrossLists',
    defaultMessage: '{count, plural, one {Tasks · # list} other {Tasks · # lists}}',
    description: 'Uppercase line above how much of each task list is done, saying how many lists there are.',
  },
  doneOf: {
    id: 'buildInPublic.doneOf',
    defaultMessage: '{done} of {total} done',
    description: 'How many of a number of tasks or checks are done, as in "12 of 20 done".',
  },
  checklistTitle: {
    id: 'buildInPublic.checklistTitle',
    defaultMessage: 'Checklist',
    description: "Title of the section of cards about the reader's daily checklist of habits.",
  },
  checklistDescription: {
    id: 'buildInPublic.checklistDescription',
    defaultMessage: 'Your consistency over the last {count, plural, one {day} other {# days}}',
    description: 'Line under the title of the checklist section, saying how many days its cards look back.',
  },
  checklistLoadFailed: {
    id: 'buildInPublic.checklistLoadFailed',
    defaultMessage: 'Your checklist could not be loaded.',
    description: "Error shown in place of the checklist cards when the reader's checklist failed to load.",
  },
  gridCard: {
    id: 'buildInPublic.gridCard',
    defaultMessage: 'Grid',
    description: 'Name of the square card showing each checklist habit as a row of squares, one a day.',
  },
  checklistStreakCard: {
    id: 'buildInPublic.checklistStreakCard',
    defaultMessage: 'Streak',
    description: 'Name of the wide card showing how many days in a row one checklist habit was kept.',
  },
  consistencyCard: {
    id: 'buildInPublic.consistencyCard',
    defaultMessage: 'Consistency',
    description: 'Name of the tall card showing how often each checklist habit was kept.',
  },
  dailyListCard: {
    id: 'buildInPublic.dailyListCard',
    defaultMessage: 'Daily list',
    description: "Name of the square card showing one day's checklist, ticked or not.",
  },
  daysField: {
    id: 'buildInPublic.daysField',
    defaultMessage: 'Days',
    description: 'Label of the setting that picks how many days a checklist card shows.',
  },
  checklistItems: {
    id: 'buildInPublic.checklistItems',
    defaultMessage: 'Tasks',
    description: 'Label of the setting that picks which habits of the daily checklist a card shows.',
  },
  checklistItem: {
    id: 'buildInPublic.checklistItem',
    defaultMessage: 'Checklist item',
    description: 'Label of the setting that picks which habit of the daily checklist a card shows.',
  },
  dayField: {
    id: 'buildInPublic.dayField',
    defaultMessage: 'Day',
    description: 'Label of the setting that picks which day of the checklist a card shows.',
  },
  today: {
    id: 'buildInPublic.today',
    defaultMessage: 'Today',
    description: 'The current day, as a card names it.',
  },
  checklistDays: {
    id: 'buildInPublic.checklistDays',
    defaultMessage: '{count, plural, one {Checklist · # day} other {Checklist · # days}}',
    description: 'Uppercase line at the top of a checklist card, saying how many days it shows.',
  },
  currentStreak: {
    id: 'buildInPublic.currentStreak',
    defaultMessage: 'Current streak',
    description: 'Uppercase line above the number of days in a row one checklist habit was kept.',
  },
  itemStreak: {
    id: 'buildInPublic.itemStreak',
    defaultMessage: '{count, plural, one {day of {item} in a row} other {days of {item} in a row}}',
    description:
      'Words under the big number of days in a row a checklist habit was kept, as in "12 days of Talk to users in a row". {item} is the habit as the reader named it.',
  },
  tasksPerDay: {
    id: 'buildInPublic.tasksPerDay',
    defaultMessage: 'Tasks done per day',
    description: 'Uppercase line above a bar chart of how many checklist habits were kept each day.',
  },
  dailyTasksDone: {
    id: 'buildInPublic.dailyTasksDone',
    defaultMessage: 'of my daily tasks done',
    description: 'Words under the big percentage of checklist habits kept, as in "74% of my daily tasks done".',
  },
  done: {
    id: 'buildInPublic.done',
    defaultMessage: 'done',
    description: 'Word after how many checklist habits were kept on a day, as in "3/4 done".',
  },
  logTitle: {
    id: 'buildInPublic.logTitle',
    defaultMessage: 'Log',
    description:
      "Title of the section of cards drawn from the team's log, where each member writes what they moved forward.",
  },
  logDescription: {
    id: 'buildInPublic.logDescription',
    defaultMessage: 'What moved forward',
    description: 'Line under the title of the log section.',
  },
  logLoadFailed: {
    id: 'buildInPublic.logLoadFailed',
    defaultMessage: 'The log could not be loaded.',
    description: "Error shown in place of the log cards when the team's log failed to load.",
  },
  logEntryCard: {
    id: 'buildInPublic.logEntryCard',
    defaultMessage: 'Log entry',
    description: 'Name of the wide card showing one log entry in full, and the label of the setting that picks it.',
  },
  quoteCard: {
    id: 'buildInPublic.quoteCard',
    defaultMessage: 'Quote',
    description:
      'Name of the square card showing a quote from a log entry, and the label of the setting that picks it.',
  },
  timelineCard: {
    id: 'buildInPublic.timelineCard',
    defaultMessage: 'Timeline',
    description: "Name of the tall card listing somebody's last log entries one under the other.",
  },
  dayCounterCard: {
    id: 'buildInPublic.dayCounterCard',
    defaultMessage: 'Day counter',
    description: 'Name of the square card showing which day of its life the organization is on, over a log entry.',
  },
  numberOfUpdates: {
    id: 'buildInPublic.numberOfUpdates',
    defaultMessage: 'Number of updates',
    description: 'Label of the setting that picks how many log entries the timeline card lists.',
  },
  updatesOption: {
    id: 'buildInPublic.updatesOption',
    defaultMessage: '{count, plural, one {# update} other {# updates}}',
    description: 'Option of how many log entries the timeline card lists, as in "3 updates".',
  },
  yesterday: {
    id: 'buildInPublic.yesterday',
    defaultMessage: 'Yesterday',
    description: 'The day before today, as a card names the day of a log entry.',
  },
  entryOption: {
    id: 'buildInPublic.entryOption',
    defaultMessage: '{day} · {text}',
    description: 'Option of the setting that picks a log entry: its day, such as "Yesterday", then its first words.',
  },
  logOn: {
    id: 'buildInPublic.logOn',
    defaultMessage: 'Log · {day}',
    description: 'Uppercase line beside the author of a log entry on a card, then its day, such as "Today".',
  },
  fromLog: {
    id: 'buildInPublic.fromLog',
    defaultMessage: "From {name}'s log · {date}",
    description:
      'Line under a quote from a log entry: whose log it is from, by first name, and its date, such as "Sep 28".',
  },
  buildLog: {
    id: 'buildInPublic.buildLog',
    defaultMessage: 'Build log',
    description: 'Uppercase line at the top of the timeline card, the log of how the company is being built.',
  },
  lastUpdates: {
    id: 'buildInPublic.lastUpdates',
    defaultMessage: '{count, plural, one {Last update} other {Last # updates}}',
    description: 'Heading of the timeline card, saying how many log entries it lists.',
  },
  dayCounter: {
    id: 'buildInPublic.dayCounter',
    defaultMessage: '<word>Day</word> <number>{count}</number>',
    description:
      'Which day of its life the organization is on, as in "Day 12". The word and the number are drawn at different sizes: keep both tags around them.',
  },
})

export default buildInPublicMessages
