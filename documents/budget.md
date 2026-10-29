# Budget

What a company spends, against what it means to spend:
- **bills**, recurring or not, each with its receipt;
- **a budget**, which an administrator sets;
- **the page that compares them**;
- **an AI that reads a receipt** into a bill;
- **a Budget module**, through which agents read the budget and add bills.

It ports the Budget page of the Claude Design prototype onto the app's own stack. The prototype was
exported on 2026-10-24 to `~/Downloads/Strategy Dance prototype budget`, in `src/pages/Budget.jsx`.
This document holds everything that page decides, its copy included, so the export is a reference
and not a dependency.

This document says how the Budget works and why. The ten milestones that built it, each one pull
request into `dev` that a Claude Code session implemented, are in
[budget-milestones.md](budget-milestones.md), with the conventions every one of them followed. The
review of M1 to M10 on 2026-10-28 changed what follows here as its pull requests did.

## Decisions

Taken with David on 2026-10-24:

- **Exchange rates are the European Central Bank's**, read through Frankfurter
  (`https://api.frankfurter.dev/v1/`). It is free, needs no key, and has daily rates since 1999. Bills
  take the 30 currencies it publishes, where the prototype offered 50.
- **Each payment converts at its own day's rate.**
  - A past payment uses the rate of the last ECB day on or before it. A future payment uses the
    latest rate.
  - The prototype stored one rate per bill, the first payment's. A subscription paid for years
    drifts away from that rate.
- **Any member adds, edits and deletes any bill**, as with the board's tasks. Only administrators
  set, change or remove the budget. Every member sees the page.
- **The module serves both kinds of agent**: external agents, at `/mcp/budget` with the page's
  agents button, and Strategy Dance's own agent, in its conversations.
- **The calling agent reads a receipt itself.**
  - `add_bill` takes the fields the agent read, and keeps the PDF or the text as the bill's receipt.
  - The module asks Claude nothing, so a bill an agent adds costs Strategy Dance no request.
- **The module's tools** are `read_budget`, `list_bills`, `read_bill`, `add_bill`, `update_bill`,
  `delete_bill` and `restore_bill`.
- **The page's upload takes PDF, text and photos** (JPEG, PNG and WebP). The prototype took PDF and
  text only.
- **The Revenue tab waits for Revenue.** It shipped as the prototype's "coming soon" placeholder, the
  first tab, and David chose on 2026-10-28 to hide it until there is revenue to show: an old
  address naming it opens Expenses.

Left for later:
- **The over-budget email and the red dot** on the nav's Budget. They need a daily check, since a
  recurring payment can tip a period over with nobody on the page. Until then the budget dialog has
  no email switch.
- **The onboarding's budget step.**
- **Revenue itself.**
- **A fiscal year that starts in another month than January.**
- **Currencies the ECB does not publish.**

## How it works

### The page

`/$organizationSlug/budget`, under Guidance in the sidebar, after Knowledge, with lucide's
`WalletIcon`.

- **Its header** has the eyebrow "Every dollar counts", the title "Budget", and the lead "What the
  company spends, and where it is headed." Its actions are:
  - an icon button that opens the budget's settings, shown on the Expenses tab only;
  - the agents button.
- **Two tabs**, kept in the search as `view`:
  - Expenses, the default, with the stats, the year's chart, the next 30 days and the spending by
    company;
  - Bills, with a count of all bills: the table, its search and its filter by payer.
- **A bill opens over the Bills tab at `/$organizationSlug/budget/$billId`**, as a task opens over
  the board, so an address the module answers lands on it.
- **Every amount the page computes is in the budget's currency**, or in US dollars while no budget
  row exists. A bill's own amount is shown as typed, in its own currency, beside its conversion.
- **Today is the browser's local date.** The year is the calendar year, and quarters are calendar
  quarters.

### The data

Five types in `schema.gql`. `Currency` is declared in strategydance-core as well, as `Locale` is,
with `schema.test.ts` failing when the two disagree. The other enums live in the schema alone:

```graphql
enum Currency { AUD BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF IDR ILS INR ISK JPY KRW MXN MYR NOK
  NZD PHP PLN RON SEK SGD THB TRY USD ZAR }
enum BudgetPeriod { MONTHLY QUARTERLY YEARLY }
enum BillRecurrence { WEEKLY MONTHLY QUARTERLY YEARLY }
enum BillReceiptStatus { UPLOADING READY }
```

- **`Budget`**: one per organization, keyed by it and deleted with it.
  - `currency`, always set.
  - `amountMinor: Int64` and `period: BudgetPeriod`, both null or both set. Removing the budget nulls
    both and keeps the currency.
  - `updatedBy: User`, and `updatedAt`.
  - With no row, the page shows US dollars and "No budget yet".
- **`Bill`**:
  - `id`, and `organization`, deleted with it.
  - `name`, `description` (empty when none) and `company`.
  - `amountMinor: Int64` and `currency`.
  - `paidOn: Date`, the payment's day, or the first payment's when it recurs.
  - `recurrence: BillRecurrence`, null for a one-time payment.
  - `endsOn: Date`, null when it keeps going. It is set only on a recurring bill, on or after
    `paidOn`.
  - `paidBy: User`, which the bill keeps when that member leaves.
  - `receipt: BillReceipt`, unique, since a receipt belongs to one bill.
  - `createdBy: User`, and `createdAt`, `updatedAt` and `deletedAt`.
  - `updatedBy: User`, who saved it last, the member an agent acts as included, written with
    `updatedAt`. Its dialog says who added it and who last changed it, and `read_bill` answers both.
  - An index on `["organizationId", "deletedAt"]`.
- **`BillReceipt`**:
  - `id`, `organization`, and `user`, the member who uploaded it.
  - `formerBill: Bill`, the bill that held it when that bill was last saved, which keeps it as an
    earlier receipt once an edit replaces or removes it, null once that bill is pruned.
  - `status: BillReceiptStatus`.
  - `name`, `contentType` and `size`.
  - `readAt`, when the receipt reader claimed it, which its daily caps count, under an index on
    `["organizationId", "readAt"]`.
  - `readFields`, the JSON text of what the read found, so asking again pays for nothing.
  - `createdAt`.
- **`ExchangeRateYear`**: keyed by `["currency", "year"]`.
  - `rates: String` is the JSON text of an object from each ECB day of that year, `YYYY-MM-DD`, to
    the units of the currency one euro bought that day.
  - `updatedAt`.
  - EUR has no row, since its rate is 1.

**Why the rates sit one row per currency and year.** A row per currency and day would be some
200,000 rows since 1999, and connectors cannot batch an insert, so the first sync would take an hour
of single-row mutations. A year of one currency is some 256 days, about 6 KB of JSON. The whole
history is about 800 rows, and a page reads only a handful: the currencies it shows, for the years
it computes.

A table references the account and the organization apart, as CLAUDE.md says, so a member's
removal keeps the bills they paid and the receipts they uploaded.

### Money and currencies

**Money is a whole number of the currency's minor units, never a float.** $312.40 is 31240 cents,
¥1,500 is 1500 yen, and 1,500 kr. of ISK is 1500.
- Each currency's exponent is ISO 4217's, held in core's `CURRENCIES`: 0 for ISK, JPY and KRW, and 2
  for the rest. It is never read off `Intl`, whose digits differ between runtimes.
- `Int64` reaches the SDK as `Int64String`. The code turns it into a number at the edges, which
  `MAX_MONEY_MINOR` (10^15) keeps exact, far below 2^53.
- **The web names a currency through `Intl.DisplayNames`** in the reader's locale, and its symbol
  through `Intl.NumberFormat`'s `narrowSymbol`. The catalogues carry no currency names.
- **An amount the agent or the page reads or writes is a decimal string**, as "312.40", turned into
  minor units by core's `parseMoney` and back by `formatMoneyAmount`.
  - Both refuse more decimals than the currency has, so "1500.5" yen is refused.
  - Both refuse anything that is not digits, optionally followed by one point and digits.

### Exchange rates

**`syncExchangeRates`, in the backend's `domain/budget/`, keeps the table current.**
1. It reads every currency and year stored (`GetExchangeRateYearKeys`), and starts from the least
   advanced currency's latest year, or from 1999 for a currency of `CURRENCIES` but EUR with no row
   at all, as one added to the list since.
2. For each year from there to the current one, it asks Frankfurter for that year's series, based on
   EUR: `/v1/<year>-01-01..<year>-12-31`, or `/v1/<year>-01-01..` for the current year. It names no
   `symbols`, so a currency the ECB stops publishing, as it stopped the rouble in 2022, the kuna in
   2023 and the lev in 2026, fails no request, and keeps the answer to the currencies of
   `CURRENCIES`.
3. It writes one row per currency for that year, an upsert, once the answer holds a day of that
   year: an empty one for a currency the ECB published nothing of, as the króna from 2009 to 2017,
   or one it stopped publishing. So a currency's latest year says how far it was fetched: a backfill
   a failure cut short carries on where it stopped, and a currency the ECB dropped moves on with
   empty rows rather than being fetched back every day.

- **Each day is filed under its own year.** Frankfurter starts a series at the last ECB day on or
  before its first date, so a year's answer opens with the previous year's last day.
- **It is idempotent.** The current year's rows are written again each day, and an older year is
  never fetched again once a later one is stored. So a closed year's answer that stops before
  December 20, which the ECB reached every year, is refused rather than written short for good.
- **The first run backfills since 1999** in about 28 requests and 800 upserts. A daily run makes one
  request and 29 upserts.
- **It runs as a step of the worker's daily `/internal/sweep`**, through `runSweepSteps`, so a day
  Frankfurter fails is caught up by the next.
- **`bun run sync:exchange-rates [--production]`**, under the backend's `scripts/`, runs it by hand.
  It fills the emulators, which need it once, and the production backfill when the release that adds
  it deploys.
- **It calls plain `fetch`** with a 20-second timeout, never the outbound guard, since the address
  is fixed and no user gave it.

**The page reads `GetExchangeRates($currencies, $years)`**, a web query any signed-in user may run,
since the rates are public.
- It is not live. It is read again on focus, as `GetTaskDescriptions` is.
- It reads the budget's currency and every bill's, for each year the page computes: this year, last
  year, and the year of each bill's last payment.
- **The module reads the same rows** through `…ForAgent` operations.
- **The latest ECB day stored is "the rates' date"**, which the budget dialog and `read_budget`
  name.

**A currency with no row for the years a payment needs converts to nothing.** That happens in a
fresh emulator before its first sync. The computations then leave the payment out and name its
currency in `missingRates`, and the page says that some amounts are not converted yet, rather than
convert them at a wrong rate.

### The computations

Everything the page and the module compute lives in strategydance-core, in `src/helpers/budget.ts`,
or in files of their own under `helpers/` beside it once it grows past one concern. They are pure,
with no dependency, over plain shapes, so the page and the module answer the same numbers.

- **Days are `YYYY-MM-DD` strings throughout.** `today` is an argument, never read from the clock:
  - the page passes the browser's local date;
  - the module passes the member's, from `User.timezone`, or the UTC date when they have none.
- **`listBillPayments(bill, from, to)`**: the days a bill is paid within `[from, to]`, both ends
  included.
  - A one-time bill pays on `paidOn`.
  - A recurring bill's k-th payment is `paidOn` plus k weeks, months, quarters or years, counted
    from `paidOn` each time, never from the payment before.
  - Its day is clamped to the month's length, so a bill paid on January 31 pays February 28 (29 in a
    leap year), then March 31.
  - Payments stop after `endsOn`, and at k = 3000, as the prototype's `bgOccurrences` does.
- **`getLastBillPayment(bill, today)`**: the last payment on or before today, else `paidOn`, which is
  then in the future, so the bill is "Due".
- **`getNextBillPayment(bill, today)`**: the first payment after today within two years.
  - A recurring bill with none has ended, and `isBillActive` says it has not.
- **`buildExchangeRateTable(rows)`** builds, per currency, the sorted days and their rates from the
  rows.
- **`findExchangeRate(table, currency, day)`**:
  - 1 for EUR;
  - else the rate of the last day on or before `day`;
  - the earliest rate before the history starts, the latest after it ends;
  - null for a currency the table lacks.
- **`convertMoney(amountMinor, from, to, day, table)`** converts through the euro, at each
  currency's rate on that day, and rounds to the target's minor units, half away from zero.
  - The same currency comes back unchanged.
  - A missing rate gives null.
- **`summarizeBudget({ bills, budget, currency, today, rates })`** is the prototype's `bgSummary`
  in minor units of `currency`. A payment counts as spent on or before today, and expected after it:
  - `month`: this month's `{ spent, expected }`. `quarter` and `year` are the same for this quarter
    and this calendar year.
  - `next`: everything next month pays.
  - `months`: twelve `{ spent, expected, isCurrent }`, January to December of this year.
  - `recurringCount`: the recurring bills with a payment next month.
  - `monthlyLimit`: the budget's amount divided by the months of its period (1, 3 or 12).
    `yearlyLimit` is the budget's share of a year, computed exactly rather than as twelve monthly
    shares, so a quarterly budget's year is its amount times four. Both are null without a budget.
  - `status`, null when neither applies:
    - in the budget's own period (`month`, `quarter` or `year`), `{ level: 'over' }` once spent
      passes the limit;
    - else `{ level: 'warn' }` once spent plus expected passes it;
    - each with `scope`, `by`, `limit` and `expected`.
  - `previous`:
    - `monthToDate`: last month from its 1st to today's day of the month, clamped to its length;
    - `yearToDate`: last year from January 1 to today's month and day, clamped;
    - `lastYear`: the whole of last year.
  - `missingRates`: every currency a payment counted here could not convert from.
- **`summarizeBudgetPeriod({ …, month })`** serves `read_budget`. For a month, its quarter and its
  year it gives:
  - `spent` and `expected` relative to today, so a past month has nothing expected and a future one
    nothing spent;
  - the limit;
  - `left`, the limit minus what was spent;
  - `projectedLeft`, which takes off what is expected too.
- **`listUpcomingPayments(bills, today, days)`**: each payment from tomorrow to today plus `days`,
  with its bill and its converted amount, sorted by day, then by name.
- **`sumSpendingByCompany(bills, today)`**: what each company was paid this year until today, sorted
  by amount, largest first.
  - Companies are grouped by their name trimmed and lowercased, and shown as the most recent bill
    spells it.
- **For speed**, a summary lists each bill's payments once over the window it needs, from January 1
  of last year to a year from today, then buckets them. It never walks a bill once per month.

### Receipts

**A receipt's file is the backend's to write and to serve**, as a conversation's files are. It is
stored at `organizations/{organizationId}/receipts/{receiptId}`, create-only, with no download token.
Deleting the organization deletes that prefix with the rest. `routes/budget.ts`, mounted at
`/organizations/:organizationId/budget` with `mergeParams`, holds three routes. Each runs
`appCheckMiddleware`, `authenticationMiddleware`, `validateMiddleware` and
`organizationMemberMiddleware`:

- **`PUT /receipts/:receiptId`** takes the file as its raw body, `uploadApiFile`'s, with its name in
  `X-File-Name`, as an attachment's upload does.
  - It reserves the receipt's row, `UPLOADING`, before reading a byte.
  - It streams the body into Storage, checked against the declared `Content-Length` and
    `MAX_BILL_RECEIPT_SIZE` (10 MiB).
  - It checks the first bytes with `sniffConversationAttachment`, and counts a PDF's pages with
    `countPdfPages`, `MAX_BILL_RECEIPT_PDF_PAGES` (20) at most.
  - It then marks the receipt `READY`, and answers its id, name, type and size.
  - The types it takes are `BILL_RECEIPT_CONTENT_TYPES`: `application/pdf`, `text/plain`,
    `text/markdown`, `text/csv`, `image/jpeg`, `image/png` and `image/webp`.
  - The page fits a photo within 2000 pixels on its long side, as JPEG, before it uploads it, as
    `createImageThumbnail` fits a picture. Claude reads no finer than that, and a phone's photo would
    otherwise pass Claude's 5 MB image limit.
  - It is metered by `billReceiptUploadRateLimitMiddleware`, 60 uploads in ten minutes per member.
  - An upload sent again carries on its reservation, unless the reservation is over a day old: the
    sweep may then be deleting it, and a file written meanwhile would be left without its row.
- **`GET /receipts/:receiptId`** answers the file to any member of its organization, read by the
  page through `requestApiFile` and drawn from an address `useObjectUrl` holds.
  - It is metered by `billReceiptReadRateLimitMiddleware`, 600 reads in ten minutes per member, as a
    conversation's files are.
- **`POST /receipts/:receiptId/read`** is the receipt reader. It belongs to the member who uploaded
  the receipt, and is covered under Reading a receipt.

**A bill names its receipt by id.** `CreateBill` and `UpdateBill` refuse a receipt that is any of:
- not `READY`;
- in another organization;
- uploaded by another member, unless it is the bill's own already, or one of its earlier receipts;
- uploaded over two days ago, unless it is the bill's own already, or one of its earlier receipts;
- held by another bill, which the receipt's unique reference also refuses. `UpdateBill` runs as one
  SQL statement, so it reports that refusal before its own check's;
- kept by another bill as an earlier receipt, however fresh and whoever uploaded it, so a bill's
  history never moves to another.

**An edit loses no receipt.** A receipt is evidence of a payment, which a company keeps for years, and
an edit that replaced or removed one used to leave it to the next sweep, beyond any undo. Every save
of a bill, the page's and an agent's, first marks the receipt the bill holds with the bill
(`formerBill`), in the same statement, so one the save lets go is kept as the bill's earlier
receipt. The bill's dialog lists its earlier receipts under its own, each with View and Use again
(`BillEarlierReceipts`, read by `GetBillEarlierReceipts` as the dialog opens), and `update_bill`
takes one back too. They go with the bill, once the sweep prunes it.

**Nothing moves a file.** A receipt is stored where it stays, and its row exists before its file, so
no file is ever without its row.

**The daily sweep prunes what nothing holds:**
- `pruneDeletedBills` deletes the bills deleted over a day ago, which sets their earlier receipts'
  `formerBill` to null.
- `pruneBillReceipts` then deletes the receipts no bill holds nor keeps that were created over three
  days ago (`BILL_RECEIPT_PRUNE_DAYS`), first the file, then the row. A save takes one only within
  two days (`BILL_RECEIPT_ATTACHABLE_DAYS`), so a save in flight as its two days run out commits
  before any sweep reads the receipt as held by nothing. That covers:
  - a receipt uploaded and never saved;
  - the receipt and the earlier receipts of a bill just pruned.
- A bill's dialog left open past two days on a receipt nothing holds yet is refused on save, saying
  to attach it again.

**The Storage emulator ignores generation preconditions**, as CLAUDE.md says, so the upload reads
what is there before it writes, as `conversationAttachmentStorage` does, and its tests simulate the
412 on `createAttachmentStorageFake`'s pattern.

### Reading a receipt

`POST /receipts/:receiptId/read` asks Claude what the receipt says, for the page's upload dialog,
which fills the bill dialog with the answer for the member to check. The module never calls it.

- **The request.** It is built as `buildConversationTaggingRequest` builds its own, by
  `buildBillReceiptReadRequest` in `domain/budget/`:
  - `claude-haiku-5-5` (`BILL_RECEIPT_READ_MODEL`), which thinks adaptively, its thinking counting
    toward its `max_tokens`;
  - `max_tokens` 1024, which the claude-api skill gives a short answer at low effort on Haiku 5.5;
  - `output_config: { effort: 'low', format: { type: 'json_schema', schema } }`;
  - no tools, betas or fallbacks, which the API offers none of for Haiku.

  The file goes in whole as a base64 block, since one request reads it once, built by
  `buildConversationAttachmentBlock`: a `document` for a PDF, an `image` for a photo, and a
  `document` with a text source for text, cut at `MAX_BILL_RECEIPT_TEXT_LENGTH` (50,000 characters).
  A photo past Claude's 5 MB, counted on its base64 (`MAX_BILL_RECEIPT_READ_IMAGE_SIZE`), is refused
  with a 413 before anything is claimed: the page fits a photo far below it, so only an upload made
  outside the page reaches it.
- **The prompt** is the prototype's: "Extract the expense from this receipt or invoice." A text block
  after the file adds today's date, so a date without a year resolves, the organization's name, so
  the model tells the seller from the buyer, and the file's name, which the prototype quoted too.
  Today is the page's, sent in the body as `{ today }`, refused more than a day off the server's
  UTC date. The schema, its nullable fields an `anyOf` with null, asks for:
  - `name`, a short label for the expense;
  - `description`, one short line, or empty;
  - `company`, the seller;
  - `amount`, the total paid, a decimal string or null;
  - `currency`, one of `Currency`, or null;
  - `paidOn`, `YYYY-MM-DD` or null;
  - `recurrence`, one of `BillRecurrence`, or null.
- **The answer** is read as `readConversationTagging` reads its own: `end_turn` only, the text
  parsed and checked with zod. It is then clamped as the prototype's `bgExtract` clamps:
  - the name at 80 characters, the description at 140 and the company at 60;
  - an amount that `parseMoney` refuses, or that is 0 or less, left empty;
  - a currency outside `Currency` left as the bill dialog's default;
  - a malformed date, or one a bill cannot be paid on (`FIRST_BILL_DAY` to `BILL_DAYS_AHEAD` days
    ahead, in core), replaced by today.

  The page drops an amount the bill dialog's currency cannot hold, when the receipt named none
  (`toBillFormValuesFromReceipt`).
- **Spend is bounded three ways:**
  - **Once per receipt.** `ClaimBillReceiptRead` sets `readAt` only where it is null, or where a
    claim over two minutes old stored nothing (`BILL_RECEIPT_READ_CLAIM_MS`), which only a backend
    that stopped mid-read leaves. The wait for a place, Storage's read and the request all fall
    within 60 seconds of the claim, Storage's read a stream the deadline destroys, since a download
    takes no signal, so a read is over, its bytes let go and its claim let go or kept, before
    another can take it over.
    A second claim meanwhile is answered 409.
    - A read that answered keeps its fields in `readFields` (`RecordBillReceiptRead`), and asking
      again answers them for nothing. A write that fails is tried three times rather than let go,
      which would pay for the read again, and the member is answered with the fields all the same.
    - One whose request failed, or that Claude answered with nothing the bill dialog takes, a
      refusal or an answer cut at its length included, clears `readAt` again
      (`ReleaseBillReceiptRead`) and answers 503, so the dialog can offer to try again.
  - **Daily caps.** `MAX_DAILY_RECEIPT_READS_PER_MEMBER` (50) and `MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION`
    (200), in strategydance-core, are counted over 24 hours on `readAt`, every receipt but the one
    asked for.
    - The claim counts them in its one query step, after the membership's lock, reading the lock's
      response. They are read before it too (`readReachedReceiptReadCap`, on `GetBillReceiptReads`),
      so a read at a cap writes nothing, and again once it is refused, for the `Retry-After`.
    - The route answers 429 with `ERROR_CODE_RECEIPT_READS_CAPPED` and a `Retry-After`, through
      `respondUsageCapped`.
    - They are lifted in development through `IS_USAGE_CAPPED` and the claim's optional
      `$isUsageCapped`, as the conversation caps are.
  - **Who may read.** The route mounts `verifiedEmailMiddleware`, then
    `conversationsSuspensionMiddleware`, after the membership, as every route that spends on Claude
    for a member does. A suspension stops this spend too.
  - **Reads that fail.** A read let go counts toward no cap, so a file Claude refuses each time could
    be asked about without end: `billReceiptReaderRateLimitMiddleware` holds a member to 30 asks in
    ten minutes, in the instance's memory.
  - **Memory.** A receipt's bytes are held by two reads at a time in an instance, the heap collected
    after each, as an upload's read-back is, since a receipt of 10 MiB is some 40 MiB in flight.
- **What it costs.** Haiku 5.5 is priced in `CLAUDE_MODEL_PRICES` at $0.10 a million input tokens,
  so a receipt of a few pages costs a fraction of a cent. The route logs each read's model, usage
  and price (`priceClaudeMessage`), since no run ledger holds it.
  - `report:usage` does not count it yet. A later pull request adds it, if the logs say it matters.
- **Under `CONVERSATION_AGENT=placeholder`**, `createPlaceholderClaudeClient` answers this schema
  with stand-in fields made from the file's name, in a branch of its own beside the tagging one: a
  name, "Placeholder company" and 42.00, the currency and the day left to the bill dialog.

### The Budget module

`budget` in `MODULES`:
- its path is `/mcp/budget`;
- its title is "Strategy Dance Budget";
- its scopes are `budget:read` and `budget:write`.

Its server is `createBudgetServer(caller)`, in `src/modules/budget/`, with one file per tool, on
`domain/budget/`. Like the Tasks module, it carries no AI permission: an agent acting as a member reads
and writes the bills as that member could, and never the budget itself, which stays an
administrator's, on the page.

Its tools, in their frozen order:

| Tool | Input | Answers | Kind |
| --- | --- | --- | --- |
| `read_budget` | `{ month? }`, `YYYY-MM`, this month by default | the budget (amount, period, currency) or null; today; the rates' date; for the month, its quarter and its year: spent, expected, limit, left and projected left; the status at today; `missingRates` | read |
| `list_bills` | `{ query?, paidFrom?, paidTo?, paidBy?, recurring?, active?, limit?, cursor? }` | up to 50 bills, by last payment, newest first. Each has its fields, its last and next payments converted, its payer, whether it has a receipt, and its address. Also `total` and `nextCursor` | read |
| `read_bill` | `{ id }` | one bill, with its receipt's name, type and size, its earlier receipts, its payments this year (count and total), who created it and when, who saved it last and when, and `version` | read |
| `add_bill` | `{ name, description?, company, amount, currency, paidOn?, recurrence?, endsOn?, paidBy?, receipt? }` | the bill, and the budget's status after it | write |
| `update_bill` | `{ id, version?, …any field of add_bill, receipt? }`, where `receipt: null` removes it and `receipt: { earlierReceiptId }` takes back an earlier one | the bill, and the status after it | write |
| `delete_bill` | `{ id }` | the bill deleted, restorable for a day | write, destructive |
| `restore_bill` | `{ id }` | the bill | write |

- **Amounts** are decimal strings in the bill's currency, and conversions are in the budget's.
  - A bill answers its last and next payments as `{ day, convertedAmount }`, converted into
    `budgetCurrency`, null where a rate is missing.
  - `read_budget` names `ratesDate`, the latest ECB day among the rates it read, null when every
    amount is in the budget's currency already and nothing converts.
- **`paidOn`** defaults to the member's today, from `User.timezone` through core's
  `getCalendarDayInTimeZone`, or the UTC date.
- **`paidBy`** is `member:<id>`, as a task's assignee is, or `"me"`, and defaults to the caller.
- **`query`** matches every word, case-insensitively, against the name, the description and the
  company.
- **`paidFrom` and `paidTo`** keep the bills with a payment between them.
- **`active`** keeps the recurring bills with a payment still to come.
- **A receipt is one of three shapes:**
  - `{ name, contentType, base64 }`: a PDF, JPEG, PNG or WebP of 700 KB at most once decoded
    (`MAX_AGENT_BILL_RECEIPT_SIZE`), under the modules' endpoint's 1 MiB body.
  - `{ name, text }`: 50,000 characters at most, kept as a `text/plain` receipt.
  - `{ attachmentId }`: for Strategy Dance's agent alone (M10), a file the member sent in the
    conversation calling, or, for a subagent, one its brief lists. Judged on its row, its type and
    the pages its upload counted, up to a receipt's 10 MiB, and copied in the bucket, never read
    again. Any other caller is refused one.
  - `{ earlierReceiptId }`, for `update_bill` alone: one of the bill's earlier receipts, which an edit
    replaced or removed and `read_bill` lists, taken back. Any other id is refused, naming
    `read_bill`.
- **A write with a receipt** checks its bytes as an upload's are, before anything is written, then
  writes the receipt's row (`ReserveBillReceiptForAgent`) and file, then the bill. So a retry that
  its key answers leaves a receipt nothing holds, which the sweep prunes.
- **What every module's tool keeps:**
  - an idempotency key per write, under `com.strategydance/idempotencyKey`;
  - `…ForAgent` operations matching the membership on `membershipCreatedAt`;
  - annotations: `readOnlyHint` on the reads, `destructiveHint` on `delete_bill`, and
    `openWorldHint: false` on all;
  - refusals as sentences;
  - results cut within `MAX_TOOL_RESULT_LENGTH`.
- **An external agent's `list_bills` with a query draws on the member's search allowance**
  (`recordModuleSearch`), as `list_tasks` does.
- **`update_bill` writes the fields it is given** on the `updatedAt` it read. When a member saved in
  between, it reads the bill again and applies its fields again, as the Tasks module's update does,
  unless it carries the `version` `read_bill` gave, the bill's `updatedAt`, when it is refused for the
  agent to read the bill again. A currency changed without an amount keeps the amount as written,
  which the new currency has to take, and a recurrence set to null ends the bill's end too.
- **`delete_bill` is withheld from subagents and refused to a reaction**, as the other deletes are.
