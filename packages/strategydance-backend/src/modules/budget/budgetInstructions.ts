import type { ModuleInstructions } from '~types'

// What the Budget module tells an agent: what the budget and the bills hold, and how amounts are
// written
const BUDGET_INSTRUCTIONS: ModuleInstructions = {
  label: 'Budget',
  holds:
    "is the organization's budget: what the company means to spend, a limit a month, a quarter or a year that an administrator sets on the Budget page, and its bills, what it spends, each paid once or every week, month, quarter or year, with its receipt.",
  paragraphs: () => [
    "A bill has a one-line name, a short description, the company paid, an amount in its own currency, the day it is first paid (paidOn), how it recurs, the day it ends if it does (endsOn), the member who pays it, and its receipt. Each payment converts into the budget's currency at the European Central Bank's rate of its own day, the latest rate for a payment still ahead, as the Budget page converts it, and today is the member's today.",
    'Amounts are decimal strings in their currency, with at most its decimals and no sign, separator or symbol: "312.40" in USD, "1500" in JPY. A member is named as member:<id>, or "me" for the member you act as. A receipt is a PDF or a photo in base64, 700 KiB at most once decoded, or the receipt\'s text: read it yourself, then add the bill with the fields you read and the receipt with them.',
    "The bills are the team's: any member adds, changes and deletes any bill, and members save bills while you do. The budget itself is an administrator's alone, which no agent changes.",
  ],
}

export default BUDGET_INSTRUCTIONS
