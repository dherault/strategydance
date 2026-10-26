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
})

export default budgetMessages
