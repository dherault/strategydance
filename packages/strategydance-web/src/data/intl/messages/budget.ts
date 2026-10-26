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
})

export default budgetMessages
