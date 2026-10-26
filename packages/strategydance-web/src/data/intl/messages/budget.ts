import { defineMessages } from 'react-intl'

/*
  The Budget page: what the company spends against what an administrator means it to spend, its
  bills, recurring or not, converted to the budget's currency at each payment's day's rate, and the
  dialog where the budget is set
*/
const budgetMessages = defineMessages({
  eyebrow: {
    id: 'budget.eyebrow',
    defaultMessage: 'Every dollar counts',
    description:
      "Small uppercase line above the title of the Budget page, where the team follows what its company spends. A short, punchy reminder that spending matters, whatever the company's currency.",
  },
  lead: {
    id: 'budget.lead',
    defaultMessage: 'What the company spends, and where it is headed.',
    description:
      'Line under the title of the Budget page, which shows what the company spends and is expected to spend.',
  },
  tabsLabel: {
    id: 'budget.tabsLabel',
    defaultMessage: 'Budget views',
    description:
      'What a screen reader calls the row of tabs at the top of the Budget page: Revenue, Expenses and Bills.',
  },
  revenueTab: {
    id: 'budget.revenueTab',
    defaultMessage: 'Revenue',
    description: 'Tab of the Budget page about what the company earns, which is not available yet.',
  },
  expensesTab: {
    id: 'budget.expensesTab',
    defaultMessage: 'Expenses',
    description:
      'Tab of the Budget page, open by default, about what the company spends: totals, a chart of the year and the payments coming up.',
  },
  billsTab: {
    id: 'budget.billsTab',
    defaultMessage: 'Bills',
    description:
      "Tab of the Budget page listing the company's bills, each a payment made once or repeating, such as a subscription. A count of the bills follows it.",
  },
  revenueTitle: {
    id: 'budget.revenueTitle',
    defaultMessage: 'Revenue is coming soon',
    description: 'Title of the Revenue tab of the Budget page, which the app does not offer yet.',
  },
  revenueText: {
    id: 'budget.revenueText',
    defaultMessage: 'You will see what the company earns here, next to what it spends.',
    description: 'Line under "Revenue is coming soon", on the Revenue tab of the Budget page.',
  },
  billsEmptyTitle: {
    id: 'budget.billsEmptyTitle',
    defaultMessage: 'No bills yet',
    description: 'Title of the Bills tab of the Budget page while the company has no bill.',
  },
  billsEmptyText: {
    id: 'budget.billsEmptyText',
    defaultMessage:
      'Upload a receipt or invoice and Strategy Dance fills in the details. Mark subscriptions as recurring to project next month.',
    description:
      'Line under "No bills yet" on the Bills tab of the Budget page. Strategy Dance is the product, whose AI reads a receipt into a bill. A recurring bill repeats each week, month, quarter or year, which lets the page forecast spending.',
  },
  loadFailed: {
    id: 'budget.loadFailed',
    defaultMessage: 'The budget could not be loaded. Check your connection and try again.',
    description:
      'Shown on the Budget page in place of its numbers when the budget, the bills or the exchange rates failed to load.',
  },
  retry: {
    id: 'budget.retry',
    defaultMessage: 'Try again',
    description: 'Button under the message saying the budget could not be loaded, which loads it again.',
  },
  budgetSettings: {
    id: 'budget.budgetSettings',
    defaultMessage: 'Budget settings',
    description:
      "Tooltip and accessible name of the icon button in the Budget page's header that opens the budget's settings, once the company has a budget.",
  },
  setBudget: {
    id: 'budget.setBudget',
    defaultMessage: 'Set budget',
    description:
      'Tooltip of the icon button in the Budget page\'s header that opens the budget\'s settings while the company has no budget, and the button of the "No budget yet" notice, for an administrator.',
  },
  close: {
    id: 'budget.close',
    defaultMessage: 'Close',
    description: 'Accessible name of the cross that closes a dialog of the Budget page.',
  },
  dialogTitle: {
    id: 'budget.dialogTitle',
    defaultMessage: 'Budget',
    description: "Title of the dialog holding the company's budget, once it has one.",
  },
  dialogTitleNew: {
    id: 'budget.dialogTitleNew',
    defaultMessage: 'Set a budget',
    description: "Title of the dialog where an administrator sets the company's budget, while it has none.",
  },
  dialogDescription: {
    id: 'budget.dialogDescription',
    defaultMessage: 'Spending is compared with this budget. Recurring bills count before they are paid.',
    description:
      "Line under the title of the budget's dialog, for an administrator. Recurring bills, such as subscriptions, count towards the budget as expected spending before their day comes.",
  },
  dialogReadOnly: {
    id: 'budget.dialogReadOnly',
    defaultMessage: 'Only administrators can change the budget.',
    description:
      "Line under the title of the budget's dialog, for a member who is not an administrator, who sees the budget without being able to change it.",
  },
  periodLabel: {
    id: 'budget.periodLabel',
    defaultMessage: 'Period',
    description: 'Label above the choice of how often the budget repeats: monthly, quarterly or yearly.',
  },
  periodMonthly: {
    id: 'budget.periodMonthly',
    defaultMessage: 'Monthly',
    description: 'Choice of a budget that is an amount per month.',
  },
  periodQuarterly: {
    id: 'budget.periodQuarterly',
    defaultMessage: 'Quarterly',
    description: 'Choice of a budget that is an amount per calendar quarter.',
  },
  periodYearly: {
    id: 'budget.periodYearly',
    defaultMessage: 'Yearly',
    description: 'Choice of a budget that is an amount per calendar year.',
  },
  amountLabel: {
    id: 'budget.amountLabel',
    defaultMessage: 'Amount per {period, select, MONTHLY {month} QUARTERLY {quarter} other {year}}',
    description:
      "Label of the field holding the budget's amount, which follows the period chosen above it: per month, per quarter or per year.",
  },
  amountInvalid: {
    id: 'budget.amountInvalid',
    defaultMessage: 'Enter an amount above 0.',
    description:
      'Error under the amount of the budget when it is empty, zero, or not a plain number in its currency, such as one with too many decimals.',
  },
  currencyLabel: {
    id: 'budget.currencyLabel',
    defaultMessage: 'Currency',
    description: 'Label of the field picking the currency of an amount.',
  },
  searchCurrencies: {
    id: 'budget.searchCurrencies',
    defaultMessage: 'Search currencies',
    description: 'Placeholder and accessible name of the search field at the top of the list of currencies.',
  },
  noCurrencies: {
    id: 'budget.noCurrencies',
    defaultMessage: 'No currencies found.',
    description: 'Shown in the list of currencies when the search matches none.',
  },
  conversionNote: {
    id: 'budget.conversionNote',
    defaultMessage:
      "Every amount on the Budget page is converted to {currency} at the rate of each payment's day. Rates are the European Central Bank's, latest {date}.",
    description:
      'Note under the fields of the budget\'s dialog. {currency} is a currency\'s code, such as "USD"; {date} is the latest day whose exchange rates the European Central Bank published, such as "Oct 24, 2026".',
  },
  conversionNoteUndated: {
    id: 'budget.conversionNoteUndated',
    defaultMessage:
      "Every amount on the Budget page is converted to {currency} at the rate of each payment's day. Rates are the European Central Bank's.",
    description:
      'Note under the fields of the budget\'s dialog, when no exchange rate was needed or read yet. {currency} is a currency\'s code, such as "USD".',
  },
  removeBudget: {
    id: 'budget.removeBudget',
    defaultMessage: 'Remove budget',
    description: "Button of the budget's dialog that removes the budget, after a second click to confirm.",
  },
  removeBudgetConfirm: {
    id: 'budget.removeBudgetConfirm',
    defaultMessage: 'Confirm removal',
    description: 'What the "Remove budget" button reads after a first click, until it is clicked again.',
  },
  cancel: {
    id: 'budget.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes a dialog of the Budget page without saving.',
  },
  save: {
    id: 'budget.save',
    defaultMessage: 'Save',
    description: "Button that saves the budget's dialog.",
  },
  budgetSaved: {
    id: 'budget.budgetSaved',
    defaultMessage: 'Budget saved',
    description: 'Notification once the budget was set or changed.',
  },
  budgetRemoved: {
    id: 'budget.budgetRemoved',
    defaultMessage: 'Budget removed',
    description: 'Notification once the budget was removed.',
  },
  saveFailed: {
    id: 'budget.saveFailed',
    defaultMessage: 'The budget could not be saved. Try again.',
    description: 'Notification when saving the budget failed, such as when the connection dropped.',
  },
  removeFailed: {
    id: 'budget.removeFailed',
    defaultMessage: 'The budget could not be removed. Try again.',
    description: 'Notification when removing the budget failed, such as when the connection dropped.',
  },
  warnTitle: {
    id: 'budget.warnTitle',
    defaultMessage: 'This {scope, select, month {month} quarter {quarter} other {year}} will go over budget',
    description:
      "Title of the warning on the Budget page when the bills still expected in the budget's current month, quarter or year will take its spending past the budget.",
  },
  warnText: {
    id: 'budget.warnText',
    defaultMessage:
      'With {expected} in recurring bills still to come, you will spend {by} more than your {limit} {scope, select, month {monthly} quarter {quarterly} other {yearly}} budget.',
    description:
      'Body of the warning that the current month, quarter or year will go over budget. {expected} is what is still to be paid in that span, {by} how far past the budget it will go, and {limit} the budget for the span, each an amount such as "$1,304".',
  },
  adjustBudget: {
    id: 'budget.adjustBudget',
    defaultMessage: 'Adjust budget',
    description: "Button of the over-budget warning, for an administrator, that opens the budget's dialog.",
  },
  noBudgetTitle: {
    id: 'budget.noBudgetTitle',
    defaultMessage: 'No budget yet',
    description: 'Title of the notice on the Budget page while the company has no budget.',
  },
  noBudgetText: {
    id: 'budget.noBudgetText',
    defaultMessage: 'Set a monthly or yearly budget to let Strategy Dance know how much you can spend on the company.',
    description:
      "Body of the notice that the company has no budget yet. Strategy Dance is the product, whose AI uses the budget when it guides the company's spending.",
  },
  missingRates: {
    id: 'budget.missingRates',
    defaultMessage: 'Amounts in {currencies} are not converted yet.',
    description:
      'Line under the numbers of the Budget page when some bills are in currencies whose exchange rates are not loaded yet, which the numbers leave out. {currencies} lists currency codes, such as "JPY and GBP".',
  },
  thisMonth: {
    id: 'budget.thisMonth',
    defaultMessage: 'This month',
    description: 'Label of the number on the Budget page for what was spent this calendar month so far.',
  },
  nextMonth: {
    id: 'budget.nextMonth',
    defaultMessage: 'Next month',
    description: 'Label of the number on the Budget page for what next calendar month is expected to cost.',
  },
  thisYear: {
    id: 'budget.thisYear',
    defaultMessage: 'This year',
    description: 'Label of the number on the Budget page for what was spent this calendar year so far.',
  },
  projectedThisYear: {
    id: 'budget.projectedThisYear',
    defaultMessage: 'Projected this year',
    description:
      'Label of the number on the Budget page for what this calendar year will have cost by its end: what was spent plus what is expected.',
  },
  comparedWithSameDaysLastMonth: {
    id: 'budget.comparedWithSameDaysLastMonth',
    defaultMessage: 'Compared with the same days last month',
    description:
      'Hover text of the percentage beside "This month", which compares it with last month from its first day to the same day of the month as today.',
  },
  comparedWithThisMonth: {
    id: 'budget.comparedWithThisMonth',
    defaultMessage: 'Compared with this month',
    description: 'Hover text of the percentage beside "Next month", which compares it with all of this month.',
  },
  comparedWithSamePeriodLastYear: {
    id: 'budget.comparedWithSamePeriodLastYear',
    defaultMessage: 'Compared with the same period last year',
    description:
      'Hover text of the percentage beside "This year", which compares it with last year up to the same day.',
  },
  comparedWithLastYear: {
    id: 'budget.comparedWithLastYear',
    defaultMessage: 'Compared with last year',
    description: 'Hover text of the percentage beside "Projected this year", which compares it with all of last year.',
  },
  expectedAmount: {
    id: 'budget.expectedAmount',
    defaultMessage: '{amount} expected',
    description: 'Line under "This month": what is still to be paid this month, such as "$1,304 expected".',
  },
  nothingElseExpected: {
    id: 'budget.nothingElseExpected',
    defaultMessage: 'Nothing else expected',
    description: 'Line under "This month" when nothing more is to be paid this month.',
  },
  recurringBills: {
    id: 'budget.recurringBills',
    defaultMessage: '{count, plural, one {# recurring bill} other {# recurring bills}}',
    description: 'Line under "Next month": how many repeating bills, such as subscriptions, are paid next month.',
  },
  spentSince: {
    id: 'budget.spentSince',
    defaultMessage: 'Spent since {date}',
    description: 'Line under "This year". {date} is January 1, written short, such as "Jan 1".',
  },
  expectedBy: {
    id: 'budget.expectedBy',
    defaultMessage: '{amount} expected by {date}',
    description:
      'Line under "Projected this year": what is still to be paid this year. {date} is December 31, written short, such as "Dec 31".',
  },
  overThisMonth: {
    id: 'budget.overThisMonth',
    defaultMessage: 'You are {amount} over budget this month',
    description:
      'Hover text of the red dot beside "This month" when spending already passed the monthly budget. {amount} is how far past it the month will end, counting what is still expected.',
  },
  overThisMonthExpected: {
    id: 'budget.overThisMonthExpected',
    defaultMessage: 'You will be {amount} over budget this month',
    description:
      'Hover text of the red dot beside "This month" when the bills still expected will take the month past its budget. {amount} is by how much.',
  },
  overNextMonth: {
    id: 'budget.overNextMonth',
    defaultMessage: 'You will be {amount} over budget next month',
    description:
      'Hover text of the red dot beside "Next month" when its bills pass the monthly budget. {amount} is by how much.',
  },
  overThisYear: {
    id: 'budget.overThisYear',
    defaultMessage: 'You are {amount} over budget this year',
    description:
      'Hover text of the red dot beside "This year" when spending already passed the yearly budget. {amount} is by how much.',
  },
  overThisYearExpected: {
    id: 'budget.overThisYearExpected',
    defaultMessage: 'You will be {amount} over budget this year',
    description:
      'Hover text of the red dot beside "Projected this year" when the year, counting the bills still expected, will pass the yearly budget. {amount} is by how much.',
  },
  barLabel: {
    id: 'budget.barLabel',
    defaultMessage: '{percent} of budget',
    description:
      'What a screen reader says of the bar under a number of the Budget page. {percent} is a percentage, such as "40%".',
  },
  barLabelWithExpected: {
    id: 'budget.barLabelWithExpected',
    defaultMessage: '{percent} of budget, {percentWithExpected} with expected bills',
    description:
      'What a screen reader says of the bar under a number of the Budget page, which shows what was spent and what is still expected. Both are percentages, such as "40%".',
  },
  spendingIn: {
    id: 'budget.spendingIn',
    defaultMessage: 'Spending in {year}',
    description:
      'Title of the chart of the Budget page showing what each month of this calendar year cost or will cost.',
  },
  legendSpent: {
    id: 'budget.legendSpent',
    defaultMessage: 'Spent',
    description: 'Key of the solid line of the spending chart, what was paid, and its row in the hover box of a month.',
  },
  legendExpected: {
    id: 'budget.legendExpected',
    defaultMessage: 'Expected',
    description:
      'Key of the dashed line of the spending chart, what is still to be paid, and its row in the hover box of a month.',
  },
  legendMonthlyBudget: {
    id: 'budget.legendMonthlyBudget',
    defaultMessage: 'Monthly budget',
    description: "Key of the black line across the spending chart, the budget's amount for one month.",
  },
  chartBudgetLabel: {
    id: 'budget.chartBudgetLabel',
    defaultMessage: 'Budget {amount}',
    description:
      'Label on the black line across the spending chart. {amount} is the monthly budget written short, such as "$2.5K".',
  },
  chartLabel: {
    id: 'budget.chartLabel',
    defaultMessage: 'Monthly spending in {year}: {months}',
    description:
      'What a screen reader says of the spending chart. {months} lists each month with what it comes to, such as "Jan $1,590, Feb $924".',
  },
  comparedWithMonth: {
    id: 'budget.comparedWithMonth',
    defaultMessage: 'Compared with {month}',
    description:
      'Hover text of the percentage in the hover box of a month of the spending chart, comparing it with the month before. {month} is that month\'s short name, such as "Sep".',
  },
  nothingYet: {
    id: 'budget.nothingYet',
    defaultMessage: 'Nothing yet',
    description: 'Shown in the hover box of a month of the spending chart when nothing was paid or is expected in it.',
  },
  overBudgetBy: {
    id: 'budget.overBudgetBy',
    defaultMessage: 'Over budget by',
    description:
      'Label in the hover box of a month of the spending chart, before how far the month goes past its budget.',
  },
  underBudgetBy: {
    id: 'budget.underBudgetBy',
    defaultMessage: 'Under budget by',
    description:
      'Label in the hover box of a month of the spending chart, before how far the month stays under its budget.',
  },
  nextDays: {
    id: 'budget.nextDays',
    defaultMessage: 'Next 30 days',
    description:
      'Title of the panel of the Budget page listing the payments due in the coming 30 days, and of its dialog.',
  },
  upcomingSummary: {
    id: 'budget.upcomingSummary',
    defaultMessage: '{total} in {count, plural, one {# expected payment} other {# expected payments}}',
    description:
      'Line under "Next 30 days": what the coming payments add up to, such as "$2,292 in 9 expected payments".',
  },
  upcomingSummaryUntil: {
    id: 'budget.upcomingSummaryUntil',
    defaultMessage: '{total} in {count, plural, one {# expected payment} other {# expected payments}}, until {date}',
    description:
      'Line under the title of the dialog listing the payments of the next 30 days. {date} is the last day it covers, written short, such as "Nov 25".',
  },
  upcomingDetail: {
    id: 'budget.upcomingDetail',
    defaultMessage:
      '{company} · {recurrence, select, WEEKLY {Weekly} MONTHLY {Monthly} QUARTERLY {Quarterly} YEARLY {Yearly} other {Scheduled}}',
    description:
      'Small line under a coming payment\'s name: the company paid, then how often the bill repeats, or "Scheduled" for a single payment set for a later day.',
  },
  morePayments: {
    id: 'budget.morePayments',
    defaultMessage: '{count} more',
    description:
      'Last line of the "Next 30 days" panel, counting the coming payments it does not list, which its dialog does.',
  },
  nothingExpected: {
    id: 'budget.nothingExpected',
    defaultMessage: 'Nothing expected',
    description: 'Title shown in "Next 30 days" when no payment is due in the coming 30 days.',
  },
  nothingExpectedText: {
    id: 'budget.nothingExpectedText',
    defaultMessage: 'Mark bills as recurring to see what is coming.',
    description:
      'Line under "Nothing expected" in the "Next 30 days" panel. A recurring bill repeats each week, month, quarter or year, so its next payments show there.',
  },
  byCompany: {
    id: 'budget.byCompany',
    defaultMessage: 'By company',
    description:
      'Title of the panel of the Budget page showing what each company was paid this year, and of its dialog.',
  },
  spentSoFar: {
    id: 'budget.spentSoFar',
    defaultMessage: 'Spent in {year} so far',
    description: 'Line under "By company": the amounts are what each company was paid this calendar year until today.',
  },
  companiesSummary: {
    id: 'budget.companiesSummary',
    defaultMessage: '{count, plural, one {# company} other {# companies}}, {total} spent in {year} so far',
    description:
      'Line under the title of the dialog listing what each company was paid this year: how many companies, and what they were paid in all, such as "16 companies, $24,331 spent in 2026 so far".',
  },
  moreCompanies: {
    id: 'budget.moreCompanies',
    defaultMessage: '{count, plural, one {# more company} other {# more companies}}',
    description: 'Last line of the "By company" panel, counting the companies it does not list, which its dialog does.',
  },
  noSpendingYet: {
    id: 'budget.noSpendingYet',
    defaultMessage: 'No spending yet',
    description: 'Title shown in "By company" when no bill was paid this year yet.',
  },
  noSpendingYetText: {
    id: 'budget.noSpendingYetText',
    defaultMessage: 'Bills paid in {year} appear here.',
    description: 'Line under "No spending yet" in the "By company" panel. {year} is this calendar year.',
  },
})

export default budgetMessages
