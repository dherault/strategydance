# Budget

| # | Milestone | Packages | Depends on | Implementation PR |
| --- | --- | --- | --- | --- |
| M1 | Money, payments and the budget's computations | core | | #249 |
| M2 | Exchange rates | database, core, backend, root | M1 | #252 |
| M3 | The budget's tables and the receipts' routes | database, core, backend, root | M1 | #255 |
| M4 | The chart | design-system, root | | #256 |
| M5 | The page and its Expenses tab | web, backend | M2, M3, M4 | #257 |
| M6 | The Bills tab and the bill dialog | web, design-system, root | M5 | #259 |
| M7 | Reading receipts | backend, database, core, web | M6 | |
| M8 | The Budget module | database, core, backend, root | M2, M3 | |
| M9 | The Budget module for external agents | backend, web, root | M8 | |
| M10 | Budget in conversations | backend, web, root | M8 | |

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

The first part says how the Budget works and why. The second gives the ten milestones that build
it, each one pull request into `dev` that a Claude Code session implements. When a milestone merges,
write its pull request number in the table above.

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
- **The Revenue tab ships as the prototype's placeholder.**

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
- **Three tabs**, kept in the search as `view`:
  - Revenue, a "coming soon" empty state;
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
  - An index on `["organizationId", "deletedAt"]`.
- **`BillReceipt`**:
  - `id`, `organization`, and `user`, the member who uploaded it.
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
1. It reads the latest year stored, or starts from 1999 when there is none.
2. For each year from there to the current one, it asks Frankfurter for that year's series, based on
   EUR, for every currency of `CURRENCIES` but EUR: `/v1/<year>-01-01..<year>-12-31?symbols=…`, or
   `/v1/<year>-01-01..` for the current year.
3. It writes one row per currency for that year, an upsert.

- **Each day is filed under its own year.** Frankfurter starts a series at the last ECB day on or
  before its first date, so a year's answer opens with the previous year's last day.
- **It is idempotent.** The current year's rows are written again each day, and an older year is
  never fetched again once a later one is stored.
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
    `yearlyLimit` is twelve times that. Both are null without a budget.
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
- uploaded by another member, unless it is the bill's own already;
- uploaded over two days ago, unless it is the bill's own already;
- held by another bill, which the receipt's unique reference also refuses. `UpdateBill` runs as one
  SQL statement, so it reports that refusal before its own check's.

**Nothing moves a file.** A receipt is stored where it stays, and its row exists before its file, so
no file is ever without its row.

**The daily sweep prunes what nothing holds:**
- `pruneDeletedBills` deletes the bills deleted over a day ago.
- `pruneBillReceipts` then deletes the receipts no bill holds that were created over two days ago,
  first the file, then the row. That covers:
  - a receipt uploaded and never saved;
  - one replaced or removed in an edit;
  - one whose bill was just pruned.
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
    that stopped mid-read leaves. The request's 60 seconds, the wait for a place included, keep a
    read under way from being taken over. A second claim meanwhile is answered 409.
    - A read that answered keeps its fields in `readFields` (`RecordBillReceiptRead`), and asking
      again answers them for nothing.
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
| `read_bill` | `{ id }` | one bill, with its receipt's name, type and size, its payments this year (count and total), who created it and when, and `version` | read |
| `add_bill` | `{ name, description?, company, amount, currency, paidOn?, recurrence?, endsOn?, paidBy?, receipt? }` | the bill, and the budget's status after it | write |
| `update_bill` | `{ id, version?, …any field of add_bill, receipt? }`, where `receipt: null` removes it | the bill, and the status after it | write |
| `delete_bill` | `{ id }` | the bill deleted, restorable for a day | write, destructive |
| `restore_bill` | `{ id }` | the bill | write |

- **Amounts** are decimal strings in the bill's currency, and conversions are in the budget's.
- **`paidOn`** defaults to the member's today.
- **`paidBy`** is `member:<id>`, as a task's assignee is, and defaults to the caller.
- **`query`** matches every word, case-insensitively, against the name, the description and the
  company.
- **`paidFrom` and `paidTo`** keep the bills with a payment between them.
- **`active`** keeps the recurring bills with a payment still to come.
- **A receipt is one of three shapes:**
  - `{ name, contentType, base64 }`: a PDF, JPEG, PNG or WebP of 700 KB at most once decoded
    (`MAX_AGENT_BILL_RECEIPT_SIZE`), under the modules' endpoint's 1 MiB body.
  - `{ name, text }`: 50,000 characters at most, kept as a `text/plain` receipt.
  - `{ attachmentId }`: for Strategy Dance's agent alone (M10), a file the member sent in the
    conversation calling, or in its parent's brief for a subagent.
- **A write with a receipt** first writes the receipt's row and file, then the bill. So a retry that
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
  between, it reads the bill again and applies its fields again, as the Tasks module's update does.
- **`delete_bill` is withheld from subagents and refused to a reaction**, as the other deletes are.

## Conventions for every milestone

- **Follow `CLAUDE.md`:**
  - a branch from `origin/dev`;
  - granular commits, each green on lint, typecheck, test and build;
  - a pull request into `dev` and the review loop;
  - then a human merges.
- **Read this document's How it works first.** Load the `claude-api` skill before writing Claude SDK
  code (M7), and never guess an SDK name.
- **Strings go in a new `budget` catalogue**, registered on the budget's route.
  - The `module` catalogue takes the module's wording, and `conversation` its tool labels.
  - `navigation` takes the sidebar's Budget.
  - `bun run translate` runs whenever a message changes.
  - No em dash in a message.
- **Web files go in their own domain folders:** `components/budget/`, `hooks/budget/` and
  `utils/budget/`.
  - One concern per file, with a waiter above the bouncer that reads its data.
  - Waiters are keyed on the organization's id.
  - No `useMemo` or `useCallback`.
- **Backend files:**
  - `routes/budget.ts`, mounted at `/organizations/:organizationId/budget` with `mergeParams`;
  - `domain/budget/` and `modules/budget/`;
  - the sweep's steps in `routes/internal.ts`.
- **Data Connect, as § The database says:**
  - a mutation writes each row once;
  - live queries name every mutation that changes them;
  - backend operations take `$userId` and check it against the rows;
  - a variable added later to an existing operation is optional.
  - Each milestone adds the tables, fields and operations it is the first to use.
- **CI runs without emulators.**
  - Domain tests mock `strategydance-database/backend` with `mock.module`.
  - The SQL conditions are checked by hand against the emulators, by `bun run check:budget` or
    `check:budget-module`, never by a `*.test.ts`.
- **A milestone that sets a convention later sessions must follow** adds it to `CLAUDE.md`, under a
  `## Budget conventions` section that M3 starts.
- **Every milestone ends with the four checks green.** A UI milestone is also looked at in a browser,
  at desktop and phone widths, against the prototype.

## Milestones

A milestone starts once the ones it depends on have merged, as the table at the top says:
- **M1 and M4** can start at once.
- **M2 and M3** can start as soon as M1 has merged.
- **M8** can run beside the page's milestones.
- **M9 and M10** can start in either order once M8 has merged.

### M1: Money, payments and the budget's computations

What the page and the module compute, in strategydance-core, before anything stores a bill.

**Currencies:**
- `Currency` in core's `enums.ts`, the 30 codes of the Decisions, in the order The data gives.
- `CURRENCIES`, each code with its ISO 4217 exponent.
- `isCurrency`.

**Money:**
- `MAX_MONEY_MINOR` (10^15).
- `parseMoney(text, currency)`, which turns a decimal string into minor units or answers null.
- `formatMoneyAmount(minor, currency)`, which turns minor units back into a decimal string, with the
  currency's digits.

**Limits**, in core's `constants.ts`:
- `MAX_BILLS` (2000);
- `MAX_BILL_NAME_LENGTH` (80), `MAX_BILL_DESCRIPTION_LENGTH` (140) and `MAX_BILL_COMPANY_LENGTH`
  (60);
- `BUDGET_PERIOD_MONTHS` (`MONTHLY`: 1, `QUARTERLY`: 3, `YEARLY`: 12).
- `BudgetPeriod` and `BillRecurrence` are typed as plain string unions here, matching the schema's
  values, since core cannot import the SDK.

**Days:**
- `addCalendarDays`, `addCalendarMonths` (clamped to the month's length), `startOfMonth`,
  `endOfMonth`, `startOfQuarter` and `compareDays`, all over `YYYY-MM-DD` strings.
- They never build a `Date` in local time, since a time zone moves a local midnight.

**The computations** of How it works: `listBillPayments`, `getLastBillPayment`,
`getNextBillPayment`, `isBillActive`, `buildExchangeRateTable`, `findExchangeRate`, `convertMoney`,
`summarizeBudget`, `summarizeBudgetPeriod`, `listUpcomingPayments` and `sumSpendingByCompany`.

**Tests:**
- **The prototype's seed scenario**, `bgSeedBills`:
  - its 19 bills and a $2,500 monthly budget;
  - today fixed at 2026-10-19;
  - a rate table built from the prototype's `BG_RATES` (USD 1, EUR 0.92), a single day each.
  - Expected: the four stats, the twelve months, the next 30 days and the companies equal what the
    prototype's `bgSummary` computes for that day. Work them out once by running the prototype's
    functions with that today, and write them into the test as literals.
- **Payments:**
  - a monthly bill started January 31 paying February 28, then March 31;
  - in a leap year, February 29;
  - a weekly bill;
  - a quarterly bill ended by `endsOn` partway;
  - a yearly bill started on February 29;
  - the 3000th payment the last one.
- **Rates:**
  - a payment on a Saturday converted at Friday's rate, and one on January 1 at December 31's;
  - one before 1999 converted at the earliest rate, and a future one at the latest;
  - EUR at 1;
  - a currency the table lacks named in `missingRates` and left out.
- **Money:** USD to JPY rounding to whole yen, and JPY to USD to cents; `parseMoney` refusing
  "1500.5" yen, "1,500", "-3", "1e3" and a value past `MAX_MONEY_MINOR`.
- **Status:**
  - `warn` when expected bills pass the limit, `over` once spent does;
  - the scope following a quarterly and a yearly budget;
  - none without a budget.
- **Previous periods:** last month's month-to-date clamped on March 31 to February's 28 days.

**CLAUDE.md:** the Stack entry of strategydance-core names the budget's computations among what it
holds.

**Verify:** the four checks pass.

### M2: Exchange rates

The ECB's daily rates in the database, kept current by the worker, read by any member.

**The schema:**
- `Currency` in `schema.gql`.
- `schema.test.ts` holds it to core's, as it holds `Locale`.
- `ExchangeRateYear`, as The data says.

**Backend connector**, each `NO_ACCESS`:
- `GetLatestExchangeRateYear`;
- `UpsertExchangeRateYear($currency, $year, $rates)`;
- `GetExchangeRatesForAgent($currencies, $years)`, for M8.

**Web connector:** `GetExchangeRates($currencies, $years)`, `@auth(level: USER)`, its comment saying
the rates are public.

**`syncExchangeRates`**, in `domain/budget/`, as Exchange rates says:
- It runs on a `fetch` it takes as an argument, so its tests hand it Frankfurter's answers. Those
  come from fixtures of real answers, a year's opening on the previous year's last day included.
- It refuses an answer whose base is not EUR, or whose rate is not a positive finite number.
- It throws rather than write a partial year, so the next run fetches it again.

**The worker:**
- **The sweep** runs `syncExchangeRates` as its first step, before the prunes, since a failure there
  must not keep a prune from running, and `runSweepSteps` already runs every step whatever failed.
- **`bun run sync:exchange-rates [--production]`**, under the backend's `scripts/`:
  - it refuses anything but the emulators without `--production`;
  - it prints the years written and the latest day.

**The web:**
- `useExchangeRates(currencies, years)`, in `hooks/budget/`, through `useQuery` and `executeQuery`
  (never the generated hook, whose query ref lags its variables).
- It is read again on focus, with `retryOnMount: false` since a waiter reads it (§ The database).

**Tests:**
- a first sync writing 1999 to the current year, the first day of 1999 being January 4;
- a second sync on the same day writing the current year only;
- a sync the day after a year turned, writing both years;
- an answer for 2026 holding 2025-12-31 filing it under 2025;
- a non-EUR base refused, nothing written;
- a timeout failing the step and the sweep going on to its other steps.

**CLAUDE.md:**
- Commands gain `sync:exchange-rates`.
- Backend conventions' sweep bullet names the rates' sync, and Frankfurter as the one outside
  address it reaches unguarded, and why.
- § The database names `ExchangeRateYear`'s shape and the reason for it.

**Verify:**
- `bun run sync:exchange-rates` fills the emulators, and its second run writes one year.
- A query of USD and JPY for 2025 answers about 256 days each.
- The four checks pass.

### M3: The budget's tables and the receipts' routes

Budgets, bills and receipts in the database, the routes that store and serve receipts, and their
prunes. Nothing draws them yet.

**The schema:** `BudgetPeriod`, `BillRecurrence`, `BillReceiptStatus`, `Budget`, `Bill` and
`BillReceipt`, as The data says.

**Web connector:**
- **`GetBudget($organizationId)`**, live, refreshed by `SetBudget`.
- **`SetBudget($organizationId, $currency, $amountMinor, $period)`**:
  - an administrator's alone, as `UpdateOrganization` checks the role;
  - an upsert, always called with every variable, `amountMinor` and `period` both null or both set;
  - an amount from 1 to `MAX_MONEY_MINOR`;
  - `updatedBy_expr: "auth.uid"`.
- **`GetBills($organizationId)`**, live:
  - every bill not deleted;
  - its receipt's id, name, type and size;
  - its payer's id, name and pictures;
  - refreshed by `CreateBill`, `UpdateBill`, `DeleteBill` and `RestoreBill` on the organization.
  - M8's writes join it.
- **`CreateBill`:**
  - The organization's lock and `MAX_BILLS` live bills, as `CreateTask` holds `MAX_TASKS`.
  - Each field's checks:
    - a name and a company on one line, trimmed, not empty, within their lengths, and a description
      within its length;
    - an amount from 1 to `MAX_MONEY_MINOR`;
    - `paidOn` from 1999-01-01 to ten years from the server's today;
    - `endsOn` only with a recurrence, and on or after `paidOn`;
    - `paidBy` a member of the organization.
  - The receipt's checks of Receipts.
  - It takes the bill's id from the browser, so a retried save stores the bill once.
- **`UpdateBill`:**
  - It writes every field, on the `updatedAt` the dialog read, and is refused when somebody saved in
    between. The dialog then says so and shows the bill as it now is.
  - `paidBy` may also stay a member who has left.
- **`DeleteBill`** sets `deletedAt`.
- **`RestoreBill`** refuses a bill deleted over a day ago, a condition in its `where`, as
  `RestoreTask` does, and holds `MAX_BILLS`.

**Backend connector:**
- `ReserveBillReceipt`, under the membership's lock, as `ReserveConversationAttachment` is;
- `CompleteBillReceiptUpload`;
- `GetBillReceiptForMember`, which serves a receipt to any member of its organization;
- `PruneDeletedBills`;
- `GetPrunableBillReceipts` and `DeleteBillReceipts`, which deletes a batch.

**`routes/budget.ts`** with `PUT /receipts/:receiptId` and `GET /receipts/:receiptId`, as Receipts
says:
- `uploadBillReceipt` and `billReceiptStorage` in `domain/budget/`, `billReceiptStorage` being the
  one module that touches the bucket for receipts;
- `billReceiptUploadRateLimitMiddleware` and `billReceiptReadRateLimitMiddleware`;
- `parseUploadHeaders`, which `parseConversationAttachmentHeaders` became, taking each route's
  limits;
- `BILL_RECEIPT_CONTENT_TYPES`, `MAX_BILL_RECEIPT_SIZE`, `MAX_BILL_RECEIPT_PDF_PAGES`,
  `MAX_BILL_RECEIPT_TEXT_LENGTH` and `MAX_BILL_RECEIPT_NAME_LENGTH` in core;
- an upload reading its file back one at a time, then collecting the heap, through
  `runUploadReadBack`, which an attachment's upload goes through too (CLAUDE.md, Backend
  conventions).

**The sweep's steps:** `pruneDeletedBills`, then `pruneBillReceipts`, as Receipts says. Each is
idempotent, deletes in batches, and leaves a receipt whose file could not go for the next sweep.

**`bun run check:budget`**, under the backend's `scripts/`, checks every condition above against
the emulators:
- `MAX_BILLS` at its bound;
- a member's role refused by `SetBudget`;
- an amount without a period refused;
- each receipt check of Receipts;
- a stale `updatedAt` refused;
- a restore past a day refused;
- a removed member's receipt kept and served;
- the prunes.

The domain's tests run against `createBudgetDatabaseFake`, the operations over tables in memory,
and `createAttachmentStorageFake`'s pattern for the bucket.

**Tests:**
- an upload whose bytes are not its declared type refused;
- a PDF of 21 pages refused;
- an upload past 10 MiB cut off and its row left `UPLOADING`;
- a member of another organization refused at every route;
- a receipt served to another member of its organization;
- the prunes deleting a receipt nothing holds at two days and keeping one a deleted bill holds;
- a second upload under the same id answered as the first, as the Storage emulator's lack of
  preconditions makes the code read before it writes.

**CLAUDE.md:**
- **Budget conventions**: the tables' rules, the receipts' path, that nothing moves a receipt's file,
  and their prune.
- **Backend conventions**: `routes/budget.ts` beside the others.
- **Commands**: `check:budget`.

**Verify:** `bun run check:budget` passes against the emulators, and the four checks pass.

### M4: The chart

The design system's chart, which the Expenses tab draws the year with.

**`components/ui/Chart.tsx`** is shadcn's chart, `ChartContainer`, `ChartTooltip`,
`ChartTooltipContent`, `ChartLegend` and `ChartLegendContent`, on `recharts`:
- installed through the shadcn CLI as the design system's other components were;
- built on shadcn's component, not the prototype's hand-drawn SVG, as every port is;
- its context and hook in files of their own, `contexts/ChartContext.ts` and `hooks/useChart.ts`,
  and no `useMemo`;
- its colors from the tokens. The config's colors are custom properties on the container's `style`,
  `--color-<key>`, since the design has one theme: shadcn's `ChartStyle`, its `<style>` element with
  a dark copy, and the config's `theme` are gone;
- its tooltip a white box with the xs radius, and the design system's focus ring on the chart,
  which recharts' accessibility layer lets the keyboard walk.
- `recharts` joins the design system's dependencies at shadcn's 3.8.0, minding the seven-day install
  cooldown, with `react-is` at React's own version, which recharts reads React's elements through.

**A story, `Chart.stories.tsx`, draws the Budget's chart** with the prototype's seed months, so the
component is shown as the page will use it. M5 ports its composition into `components/budget/` and
its helpers into `utils/budget/`, the story staying `ChartContainer`'s:
- the months in minor units, as `summarizeBudget` gives them, drawn in whole units of the currency;
- an `Area` with the primary-50 gradient under the line;
- one monotone line of what each month comes to, drawn twice through two clips that the current
  month's x places, from recharts' `useXAxisScale`: solid primary up to the current month, and
  dashed at 70% opacity from it on, so the halves meet as one curve. A `Line` sets its curve's
  `clipPath` itself, so each clip goes through its `shape`, recharts' `Curve`;
- the current month's dot, 4 px, white-ringed;
- a `ReferenceLine` at the monthly limit, black, 1.5 px, labelled "Budget $2.5K" at its left in the
  compact currency;
- the y axis in compact currency with dashed grid lines, from $0, as the prototype's screenshot
  has it: four to six round ticks a fifth above the year's highest month and the budget
  (`getSpendingTicks`). The x axis is the month's short names, the current one bold, which recharts
  thins on a phone;
- a tooltip as the prototype's, `ChartTooltipContent` handed the hovered month's rows:
  - the month and the year, with the change from the month before;
  - Spent and Expected, each with its key;
  - "Nothing yet" when both are 0;
  - and, below a rule, "Over budget by" or "Under budget by".
- the chart's `aria-label`, "Monthly spending in {year}: {month} {amount}, …", on its `<svg>`.
- A second story shows the chart with no budget, and a third with a year of zeros.

**The design sync:**
- **`.design-sync/config.json`'s `titleMap`** maps the stories' title, Chart, to `ChartContainer`,
  since shadcn exports no `Chart`. The converter then names the component `ChartContainer`.
- **Its `dtsPropsFor`** gains `ChartContainer`'s props.
- **`.design-sync/docs/ChartContainer.md`** says what it is for and how the budget uses it. A commit
  under `.design-sync/` is scoped `[root]`.
- **The global gains `Recharts`**, through `buildPackage.ts`'s entry as Lucide's `Icons`, since a
  design builds its series from recharts' own parts: those `.design-sync/rechartsParts.ts` lists,
  the cartesian charts and the pie, since recharts whole took the bundle 40 KB short of the upload's
  12 MiB a file. `checkNames.ts` reads the titles through the `titleMap`, the names a note takes
  from `Recharts`, and the `--color-<key>` a note's chart sets.
- **`bun .design-sync/checkNames.ts` and `bun .design-sync/runExamples.ts`** pass.
- **The Claude Design project gets it at the next `/design-sync`**, which a person starts.

**Verify:** the stories in Storybook, at desktop and phone widths, then the four checks.

### M5: The page and its Expenses tab

The Budget's page, its navigation, its three tabs, the Expenses tab whole, and the budget dialog.
The Bills tab shows its empty state until M6.

**The route and the sidebar:**
- `routes/_authenticated/_app/$organizationSlug/budget.tsx`, registering the `budget` catalogue,
  then `BudgetWait` (budget, bills and rates), keyed on the organization's id, then `BudgetPage`.
  The waiter keeps the team's live query open without waiting on it, as every organization's page
  does.
- `validateSearch` is `parseBudgetSearch`, which keeps `view` to `revenue`, `expenses` and `bills`
  and overwrites anything else with `undefined` (§ Routing).
- A `NavigationLink` in the sidebar's Guidance group, after Knowledge, with `WalletIcon` and
  `navigationMessages.budget`.

**The hooks:**
- `useBudget` and `useBills`, live, as `useTasks` is.
  - `useBudget` answers `{ limit, currency }`: the budget or null, and its currency, USD without a
    row.
  - `useBills` reads each row into core's shape through `toBudgetBill`, its payer and receipt kept
    beside it for M6.
  - Each `Int64String` becomes a number where it is read.
- `useBudgetExchangeRates(today)`: M2's `useExchangeRates` over the budget's currency and every
  bill's, for the years `listExchangeRateYears` names: this year, last year, and each bill's last
  payment's year.
- `useBudgetSummary` runs `summarizeBudget` on `useLocalDate`'s today, which rechecks every minute
  and on focus, so the page turns at midnight. It answers the inputs beside the summary, so the
  panels count from the same bills, rates and day.
- `useSetBudget` wraps the generated mutation and always sends every variable.
- `useBudgetReads` says whether the budget, the bills or the rates failed. The page then shows
  `BudgetLoadFailed`, a danger `Alert` with "Try again", in place of its tab, as the board does.

**recharts in the web.** The chart's composition imports recharts' parts (`Area`, `Line`, `Curve`,
`useXAxisScale`…), so the web declares `recharts` and `react-is` at the design system's ranges. Both
packages then resolve one copy, which recharts' context needs: the chart is web's and its
`ChartContainer` the design system's. CLAUDE.md's Stack says so.

**The header**, as The page says:
- the settings button an outline icon `Button` (`SlidersHorizontalIcon`) with a `Tooltip`, "Budget
  settings", or "Set budget" before there is one, on the Expenses tab only;
- the agents button is M9's.

**The tabs** are the design system's `Tabs`, in its routing mode. Bills' `count` is the number of
bills, and choosing a tab navigates the `view` search, leaving Expenses out of the address.
- The Revenue tab is an `Empty`:
  - the wallet icon;
  - "Revenue is coming soon";
  - "You will see what the company earns here, next to what it spends."
- The Bills tab is M6's "No bills yet" `Empty`, without its "New bill" until M6. Nothing can add a
  bill before M6 or M8, so in production it says the truth.

**Alerts:**
- **When the status is `warn`**, a warning `Alert` titled "This {month, quarter or year} will go
  over budget": "With {expected} in recurring bills still to come, you will spend {by} more than
  your {limit} {monthly, quarterly or yearly} budget." An administrator also gets "Adjust budget".
- **Without a budget**, an info `Alert`: "No budget yet". "Set a monthly or yearly budget to let
  Strategy Dance know how much you can spend on the company." An administrator also gets "Set
  budget".
- **Once over**, the prototype shows no alert: the stats' red dots say it. Kept.
- **When `missingRates` names a currency**, a muted line under the stats: "Amounts in {currencies}
  are not converted yet.", the codes joined by `formatList`.

**Four stats**, `BudgetStat`, in `BudgetStats`' grid:
- four columns, two below 820 px of the page's container, one below 420 px, as the prototype's
  container queries;
- each on the grid's rows (`grid-rows-subgrid`), so the four line up: a label, a value, its change
  and its red dot, a bar, and a foot.

| Stat | Value | Change against | Bar | Foot | Red dot's tooltip |
| --- | --- | --- | --- | --- | --- |
| This month | spent | the same days last month | spent, and with expected, of the monthly limit | "{expected} expected", or "Nothing else expected" | "You are" or "You will be" "{x} over budget this month", once spent plus expected passes the limit |
| Next month | next | this month's spent plus expected | next, of the monthly limit | "{n} recurring bill(s)" | "You will be {x} over budget next month" |
| This year | spent this year | the same period last year | spent, of the yearly limit | "Spent since {Jan 1}" | "You are {x} over budget this year" |
| Projected this year | spent plus expected | last year | spent, and with expected, of the yearly limit | "{expected} expected by {Dec 31}" | "You will be {x} over budget this year" |

- **The change** is a whole percentage (`getBudgetChange`), written with `signDisplay:
  'exceptZero'`, with "Compared with {comparison}" as its title. It is hidden when the comparison is
  0.
- **The bar**, `BudgetBar`, has four segments, which `getBudgetBarSegments` places:
  - spent up to the limit, primary;
  - spent past it, danger;
  - expected up to the limit, primary-200;
  - expected past it, red-200.
  - Past 100%, the bar spans the whole and a white mark shows where the limit ends.
  - Its `aria-label` is "{p}% of budget", with ", {q}% with expected bills" when it applies.
- **The red dot** is a focusable `role="img"` in a `Tooltip` that a tap opens too.
- **Without a budget** there is no bar and no dot.
- **The days** "Jan 1" and "Dec 31" are written in the reader's locale.

**"Spending in {year}"**, a `PageSection` whose actions hold `BudgetChartLegend`: Spent, Expected,
and Monthly budget with a budget.
- It draws `BudgetSpendingChart`, M4's story ported to the page, with its clips, tooltip label and
  tooltip row in files of their own and its tooltip's rows from `toSpendingTooltipRows`.
- Every word comes from the catalogue, the `aria-label` "Monthly spending in {year}: {month}
  {amount}, …" included. Month names and amounts are in the reader's locale.
- The story stays in the design system as `ChartContainer`'s, which Storybook and the design sync
  grade. Nothing of the design system changes.

**Two panels** side by side, one column below 760 px of the page.
- **Each is a `BudgetPanel`**, a card that opens a dialog, with a chevron that turns primary on
  hover.
  - Its heading holds the dialog's trigger, a button stretched over the card, since a heading
    cannot sit inside a `<button>`. The prototype's `role="button"` section would hide its list
    from a screen reader.
  - The focus ring circles the card.
  - Side by side, the cards reach past the page's edge by their padding, so their text lines up
    with it. Stacked, they keep within a phone's narrower gutter.
- **"Next 30 days"**:
  - its line is "{total} in {n} expected payment(s)";
  - the five first payments, each with its day, its bill's name, "{company} · {recurrence}", or
    "· Scheduled", the prototype's word, for a single payment, and its converted amount, then
    "{n} more";
  - a payment whose currency has no rate yet shows its own amount in its own currency, and the
    total counts those converted;
  - empty, "Nothing expected", "Mark bills as recurring to see what is coming.".
  - Its dialog lists all of them, with the year in each day, its line ending "until {date}". Its
    rows open their bills once M6 adds the bill dialog.
- **"By company"**:
  - its line is "Spent in {year} so far";
  - six bars, the design system's `Progress`, each relative to the largest, then "{n} more
    companies";
  - empty, "No spending yet", "Bills paid in {year} appear here.".
  - Its dialog lists every company with its share, "· {p}%", under "{n} companies, {total} spent in
    {year} so far".
- Both dialogs scroll whole, 560 px wide, as the app's other long dialogs do.

**The budget dialog**, `BudgetDialog` around `BudgetDialogForm`:
- **Its opener**, the header's button or an alert's, is its `DialogTrigger`, so the focus goes back
  to it once it closes. The form mounts with the dialog's content, so each opening starts from the
  budget as it stands.
- **Its title** is "Budget", or "Set a budget".
- **Its description** is "Spending is compared with this budget. Recurring bills count before they
  are paid." Members see "Only administrators can change the budget." instead, with every field
  disabled and no actions.
- **The form** is react-hook-form with zod, as `AccountPasswordForm` is, so its error shows once it
  was submitted.
- **The fields:**
  - "Period", the `Radio`s Monthly, Quarterly and Yearly in a `radiogroup`;
  - "Amount per {month, quarter or year}", a decimal input checked by `parseMoney` in the currency
    picked, above 0, placeholder 2500, "Enter an amount above 0.";
  - "Currency", `CurrencySelect`.
- **Below them**, "Every amount on the Budget page is converted to {currency} at the rate of each
  payment's day. Rates are the European Central Bank's, latest {date}."
  - The date is the latest day of the rates the page read (`getLatestExchangeRateDay`).
  - With none read, as for a company counting only in euros, the sentence ends at "Rates are the
    European Central Bank's."
- **Its actions:**
  - "Remove budget", when there is one, armed by a first click to "Confirm removal" (`Button`'s
    `confirm`);
  - Cancel and Save, Save waiting for a change.
- **Toasts:** "Budget saved", "Budget removed", or "The budget could not be saved" or "…removed.
  Try again." on a failure.

**`CurrencySelect`**, in `components/budget/`:
- the design system's `Combobox`, searchable;
- each option is the currency's narrow symbol (`getCurrencySymbol`), in a 28 px column, then its
  name from `Intl.DisplayNames` in the reader's locale, sorted by name;
- the search matches the code, the symbol or the name, the last two as the option's `keywords`.

**Amounts:**
- **Formatting.** `formatBudgetAmount(minor, currency, locale, { exact? })`, in `utils/budget/`, is
  `Intl.NumberFormat` with `style: 'currency'`. It rounds to whole units unless `exact`, and sets
  the fraction digits from `CURRENCIES`, never from `Intl`. `formatCompactBudgetAmount` writes the
  chart's ticks and its budget's label.
- **Days**, `formatBudgetDay(day, today, locale, { withYear? })`, are `Intl.DateTimeFormat` short
  month and day, with the year when it is not this year, read as a UTC date so no time zone moves
  them.

**`bun run seed:budget <email> [--organization <id or slug>]`**, `scripts/seedBudget.ts` in the
backend's package:
- emulators only, through the Admin SDK's GraphQL, as `grantAdministrator.ts` writes;
- the prototype's $2,500 monthly budget in US dollars and its 19 bills, dated around the machine's
  today as `bgSeedBills` dates them, into the account's organization, or the one named;
- the organization's members paying them in turn;
- each bill's id derived from the organization and the bill, so a second run moves the same bills to
  the new today rather than adding 19 more;
- no receipts, which M6 can add.

**CLAUDE.md:**
- Budget conventions: the page computes through `useBudgetSummary` on `useLocalDate`'s today,
  reads the years `listExchangeRateYears` names, turns an `Int64String` into a number where it is
  read, and writes amounts and days through `utils/budget/`;
- Commands gain `seed:budget`;
- the design system's Stack entry says why the web declares recharts and react-is.

**Verify:**
- In a browser against the emulators, with `sync:exchange-rates` run and bills seeded by `bun run
  seed:budget <email>`.
- At desktop and phone widths, against the prototype rendered from its export, as a member and as
  an administrator:
  - the stats, the chart's tooltip and both panels and their dialogs;
  - each tab, and `?view=` anything else falling back to Expenses;
  - the dialog: setting, changing the period and the currency, removing, and a member's read-only
    view;
  - the warning and the "No budget yet" alerts;
  - a currency without rates named under the stats;
  - no horizontal scroll at 390 px.
- The four checks pass.

### M6: The Bills tab and the bill dialog

Adding, editing, viewing and deleting bills by hand, with their receipts. Reading a receipt is M7's.

**The toolbar**, `PageToolbar`, shown once there is a bill:
- **A `SearchInput`**, "Search bills". Escape clears it. Every word must match the name, the
  description or the company, ignoring case (`filterBills`).
- **A "Paid by" `Select`**:
  - "Everyone", with the users icon, then each member with their avatar, the reader's own followed
    by " - me";
  - also anyone a bill names who has since left, by the name the bill kept, or "A former member"
    (`listBillPayers`, `useBillPayers`).
  - On a phone, the search and the select each take the whole row.
- **"New bill"**, primary, with a plus, which opens the bill dialog empty. From M7 it opens the
  upload dialog.

**The table**, the design system's `Table`:
- **Bill**: its name, a link to the bill that wraps to two lines at most, with its description below
  in muted text, cut at 32 characters' width.
- **Company**.
- **Paid by**: their avatar and first name, or "-".
- **Date**:
  - "Due {day}" while the first payment is still ahead;
  - else its last payment's day, with "Next {day}" below while it recurs.
- **Repeats** (`getBillRepeatState`):
  - a `Badge` with the repeat icon and the period while it recurs;
  - an outline "Ended" once its first payment is past and it has none to come;
  - muted "One-time" otherwise.
- **Amount**, right-aligned: its own, exact, with "≈ {converted, exact}" below when its currency
  differs from the budget's, at its last payment's rate, left out while that currency has none.
- **Actions**: "View receipt" when it has one, and "Edit", icon buttons with tooltips.
- **Company, Paid by and Repeats hide below 800 px of the container.** The prototype hides them below
  760 px of its page, which is 16 px narrower than ours. At 800 a 1280-wide screen shows its three
  columns, where the six would cut a name to a few letters.
- **The actions hide below 480 px**: on a phone a row opens its bill, whose dialog shows its receipt.
- **Rows sort by their last payment, newest first**, then by name (`sortBillsByLastPayment`). A
  click on a row, outside its controls, opens the bill.
- **Empty states**, the design system's `Empty`:
  - No bills: "No bills yet", "Upload a receipt or invoice and Strategy Dance fills in the details.
    Mark subscriptions as recurring to project next month.", "New bill".
  - Nothing matches: "No bills match", "Search looks at names, descriptions and companies. Try
    another person or clear the filters.", "Clear filters".

**The bill dialog**, `BillDialogForm`, in `BillDialog` or `NewBillDialog`:
- **Where it opens:**
  - over the page at `budget.$billId.tsx`, as `tasks.$taskId.tsx` opens a task, its bill read from
    the live list, `budget.tsx` rendering an `Outlet`;
  - the page's tab under it is Bills, unless the address names another, as the upcoming list's
    rows name Expenses;
  - an id that is no 32 hex digits is a `notFound()` in `beforeLoad` (`isBillId`), and one naming no
    bill as the dialog opens is a `notFound()` thrown by `BillBouncer`;
  - a bill deleted while its dialog is open, by another member, goes back to the page;
  - whatever opens a bill passes `state: { isFromBudgetPage: true }`, so closing steps back;
  - a new bill opens as a plain dialog, from a `DialogTrigger`.
- **Focus.** An existing bill opens focused on the dialog, as a task does, rather than on its name
  selected whole. Radix gives the focus back only to its own trigger, so the routed dialog notes what
  had it as it opened, the row's link or Edit, and gives it back there.
- **Its title** is "New bill" or "Edit bill".
- **Its description** is "Bills count towards spending on the day they are paid.", or "Added
  {date}".
- **The fields** scroll between the header and the actions, which stay in view, as the prototype's
  do. In order:
  - **Name**: placeholder "Figma Professional", "Enter a name.".
  - **Description**: a `Textarea`, "What it was for".
  - **Company paid** (`BillCompanyField`):
    - an `Input` with a `SuggestionList` of the organization's companies (`listBillCompanies`), the
      case-insensitive matches but an exact one (`suggestBillCompanies`), every company while the
      field is empty;
    - the arrows move, Enter picks, and Escape closes the list rather than the dialog, claimed on the
      window as the rich text editor claims it;
    - placeholder "Figma", "Enter the company you paid.".
  - **Amount and Currency**, side by side:
    - the amount a decimal input checked by `parseMoney`, "0.00", "Enter an amount above 0.";
    - the currency `CurrencySelect`, defaulting to the budget's.
  - **Paid on and Paid by**:
    - "First payment" while the bill recurs, a day picked with the calendar `TaskDueDateField` uses
      (`BillDayField`), from 1999 to ten years ahead, "Pick a date.";
    - Paid by a `Select` of the members, defaulting to the reader, and the bill's payer should they
      have left.
  - **"Recurring payment"**, a `Switch` with the hint "Repeats on the same day each period. Used to
    project spending.". Turned on, it shows:
    - "Repeats", a `Select` of Weekly, Monthly, Quarterly and Yearly, Monthly first picked;
    - "Ends", a day from the first payment on, with Clear, "Leave empty if it keeps going.", "Pick a
      date after the first payment.".
  - **"Receipt"** (`BillReceiptField`):
    - empty, an `ImageDropzone` with the upload icon, taking `BILL_RECEIPT_CONTENT_TYPES`, "Drop a
      receipt here or click to choose", "PDF, text file or photo";
    - attached, the file's name and size, with View, Replace and Remove, the last after a
      confirmation;
    - uploading, its progress.
- **Uploading a receipt** (`useBillReceiptDraft`):
  - A file dropped or chosen uploads at once through `useUploadBillReceipt` (`uploadApiFile`, with
    its progress).
  - A photo is fitted within 2000 pixels as a JPEG first, renamed `.jpg` (`fitBillReceiptPhoto`), and
    the name is held to the backend's rules (`toUploadName`).
  - Save waits for the upload.
  - A type outside the list toasts "Attach a PDF, text file or photo".
  - A file past 10 MB or 20 pages, too many uploads, or a failure each toast why, and the field goes
    back to the receipt it held.
- **Its actions:**
  - Cancel, and "Add bill" or "Save", Save waiting for a change;
  - on an existing bill, "Delete", danger, after a confirmation.
  - They stay in one row at every width.
- **Errors** show once the form was submitted, as react-hook-form's `FormField` shows them.
- **Toasts** (`useSaveBill`, `useDeleteBill`):
  - "{name} added", or "Bill saved";
  - "{name} puts you over budget", a warning in their place, when the save moves the status to
    `over` (`isPushedOverBudget`). A bill in a currency with no rate yet counts for nothing, so it
    raises none;
  - "{name} deleted" with "Undo", which calls `RestoreBill`.
- **A refused save reads the bills again from the server** (`useReloadBills`), past the SDK's cache:
  - a new bill found there was added after all;
  - an edited one gone was deleted meanwhile, which a toast says;
  - one whose `updatedAt` moved shows "Somebody changed this bill meanwhile. Check it, then save
    again." in a warning `Alert`, with the bill as it now is, which a save then goes through on;
  - otherwise the refusal's message tells a receipt to attach again, which the field drops, from the
    organization's `MAX_BILLS` (`readBillSaveRefusal`).
  - `UpdateBill` reports the receipt's unique reference before its own check, so the message alone
    would not tell a stale save.

**The receipt dialog**, `BillReceiptDialog`, from the table and from the bill dialog:
- **Its title** is the bill's name, and its description "{file} · {company} · {amount, exact}".
- **Download** sits in its header, a link to the file's address.
- **The file is fetched** by `useBillReceiptFile` (`requestApiFile` with the reader's token), kept,
  and drawn from an address `useObjectUrl` holds. An upload leaves its file there, so a receipt just
  attached is drawn without being read back:
  - a PDF in an `iframe` as tall as the screen allows;
  - a photo as an `img`;
  - text on a white "paper" in the monospaced face.
  - One that cannot be read says so, with "Try again".
- **It is wide**, up to 1040 px.

**The upcoming list.** The rows of the "Next 30 days" dialog open their bills over the Expenses tab,
the list staying open under them. The panel's own rows open nothing, since the card is the button
that opens the list.

**The design system:**
- `ImageDropzone` takes an `icon`, an image unless set, with a story of a receipt's zone.
- `.design-sync`'s props and note follow it.

**Shared helpers:**
- `formatFileSize`, `readFileType` and `toUploadName` in `utils/common/` are the conversation's
  helpers made to serve a receipt too.

**Not done:** `seed:budget` still writes no receipt, since a receipt takes a Storage file.

**Verify:** in a browser, against a scratch emulator suite with the backend, at 1280 and 390 px,
against the prototype:
- a bill added by hand with a PDF, edited, its receipt replaced with a photo fitted to a JPEG, and
  viewed;
- deleted and undone;
- the table searched and filtered, by a payer who has left too;
- a stale save across two tabs;
- the over-budget warning;
- a bill's address opened directly, and one naming no bill;
- an upcoming row opening its bill;
- the focus going back to what opened each dialog.

The four checks pass.

### M7: Reading receipts

The reader of Reading a receipt, and the upload dialog that fills a bill from it.

**The backend:**
- `POST /receipts/:receiptId/read` in `routes/budget.ts`, with `express.json`, App Check, the token,
  `billReceiptReaderRateLimitMiddleware`, the parameters' and body's check, the membership,
  `verifiedEmailMiddleware` and `conversationsSuspensionMiddleware`, as Reading a receipt says. It
  answers 200 `{ fields }`, 403 for an outsider or another member's receipt, 404, 413, 409 while
  another read goes, 429 through `respondUsageCapped`, which takes a `receiptReads` kind, and 503.
- In `domain/budget/`: `billReceiptReadSettings`, `billReceiptReadPrompt`,
  `buildBillReceiptReadRequest`, `readBillReceiptFields`, `readReachedReceiptReadCap` and
  `requestBillReceiptRead`.
- On the database: `BillReceipt`'s `readAt` and `readFields`, an index on `["organizationId",
  "readAt"]`, then `GetBillReceiptForReader`, which reads the organization's name the prompt quotes,
  `GetBillReceiptReads`, `ClaimBillReceiptRead`, `RecordBillReceiptRead` and
  `ReleaseBillReceiptRead`. `schema.test.ts` holds the claim's and the read's counts to core's caps.
- In core: `MAX_DAILY_RECEIPT_READS_PER_MEMBER`, `MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION`,
  `ERROR_CODE_RECEIPT_READS_CAPPED`, the `BillReceiptFields` and `BillReceiptReadData` shapes,
  `isCalendarDay`, and `FIRST_BILL_DAY` and `BILL_DAYS_AHEAD`, which the bill dialog read from its
  own constants before.
- The placeholder's branch, and `priceClaudeMessage` beside the ledger's prices.
- The comment on Haiku's price in `CLAUDE_MODEL_PRICES` names the reader beside the tagging.
- `check:budget` gains the claim's conditions: the caps at their bound, reads past 24 hours and the
  receipt asked for left uncounted, the caps lifted, a second claim refused, a release clearing it,
  a record once only, and a stale claim taken over while a fresh one is not.
- `probe:claude` gains a check of the request against Claude, reading a text receipt into its
  schema. It is not run in M7's verification: the probe runs every check, and David runs it.

**The upload dialog**, `BillUploadDialog`, which "New bill" opens, in the toolbar and in the empty
state, in place of M6's `NewBillDialog`:
- **One dialog**, the upload (`BillUploadPanel`) and then the bill's form in its place, 480 px wide,
  then 560. The focus goes to the dialog when the form takes over, and back to "New bill" when it
  closes.
- **Its title** is "New bill".
- **Its description** is "Upload the receipt or invoice. Strategy Dance fills in the bill for you.",
  then, while it reads, "Strategy Dance is reading the receipt. You can check everything before it
  is saved.".
- **A dropzone**, the design system's `ImageDropzone` with the upload icon, offers "Drop a receipt
  here", "PDF, text file or photo", and "Choose file", drawn as a button on the zone, which is the one
  control. "Enter it manually" below it opens the bill dialog empty.
- **Three steps** (`BillUploadSteps`), each with a dot, a spinner or a check, announced as they
  change:
  - "Uploading {file}", done when the upload completes, with its progress;
  - "Reading the document", from the ask, for 700 ms;
  - "Finding company, amount and date", until the answer lands, held at least 600 ms so it never
    flashes.
- **The upload** goes through the bill dialog's `useBillReceiptDraft`, its photo fitting, naming,
  progress and toasts with it, which tells what it holds once settled (`readHeld`). The read is
  `useReadBillReceipt`, and `useBillUpload` runs the steps.
- **On the answer**, the bill dialog opens with the fields filled (`toBillFormValuesFromReceipt`) and
  the receipt attached, under an info `Alert` with the sparkles icon (`BillReadNotice`): "Filled in
  from {file}. Check each field before saving."
- **When it fails** (`readBillReceiptReadFailure`):
  - **A read refused at its cap** opens the bill dialog with the receipt attached and the fields
    empty, saying "Strategy Dance has read as many receipts as it can today. Fill in the bill
    yourself.".
  - **An address not confirmed**, and **a suspended member**, do the same, as David chose on
    2026-10-27, saying "Confirm your email address so Strategy Dance can read receipts. Fill in the
    bill yourself." and "Strategy Dance cannot read receipts for you right now. Fill in the bill
    yourself.".
  - **A read that failed** toasts "Could not read {file}", and the dialog says so with "Try again",
    which asks again with no upload, and "Enter it manually", which keeps the receipt attached.
  - **A file of another type** toasts "Upload a PDF, text file or photo".

**Tests:**
- the request's bytes, model and schema, a PDF, a photo and a text cut at 50,000 characters;
- an answer clamped, an amount "1,500.00" left empty, a day past a bill's left for today;
- a refusal, a `max_tokens` stop and a failed request answered as a failed read and released;
- a second read answered from `readFields` with no request;
- a read under way answered busy, and one claimed over two minutes ago taken over;
- the caps' 429 with `Retry-After`;
- an unverified address and a suspended member refused before anything is claimed;
- the placeholder's answer read through `readBillReceiptFields`;
- the bill dialog's values from what was read, and the failures sorted by their codes.

**CLAUDE.md**, Budget conventions:
- the reader's caps and why each receipt is read once;
- that the reader's usage is logged and not ledgered;
- that the placeholder answers its schema.

**Verify:**
- `check:budget` passed against a scratch suite on the branch's schema.
- Under `CONVERSATION_AGENT=placeholder`, the whole flow in a browser at 1280 and 390 px: a PDF read
  into a bill and added, "Enter it manually", a file of another type, a failed read tried again and
  entered by hand, the cap, an unconfirmed address and a suspension, each made with `page.route`,
  and the focus back on "New bill".
- Then against Claude, with an invoice PDF, a photo of a paper receipt, and a text receipt. This
  costs a cent or so.
- The four checks pass.

### M8: The Budget module

The budget as Strategy Dance's fourth module, as The Budget module says. Nothing in the app calls it
yet, and Claude Code reaches it locally over stdio.

**The frame:**
- `MODULES` gains `budget`, and `MODULE_SERVERS` its `createBudgetServer`.
- `moduleServers.test.ts` checks its tool names against the other modules'.
- `createModuleAddresses` takes `'budget'`, a bill's address being `/{organization}/budget/{id}`.

**`src/modules/budget/`:**
- the seven tools, one file each;
- `budgetModule.ts`, `budgetTools.ts`, `budgetSchemas.ts`, `readBudgetWriteCall.ts`,
  `toBudgetRefusal.ts` and `toBudgetWriteResult.ts`, as the Tasks module's.

**`domain/budget/`:** `readBudget`, `listBills`, `readBill`, `addBill`, `updateBill`, `deleteBill`,
`restoreBill` and `writeAgentBillReceipt`. The last writes a receipt's row and file from a base64 or
a text receipt, sniffed as an upload is.

**Backend-connector operations**, each matching the membership on `membershipCreatedAt`:
- **Reads:**
  - `GetBudgetForAgent`: the budget, every live bill, and the member's `timezone`;
  - `GetBillForAgent`;
  - `GetExchangeRatesForAgent`, from M2.
- **Writes**, each an `@transaction` inserting its `ModuleCallResult` first under `@include(if:
  $isKeyed)`:
  - `CreateBillForAgent`, `UpdateBillForAgent`, `DeleteBillForAgent` and `RestoreBillForAgent`, with
    `CreateBill`'s, `UpdateBill`'s, `DeleteBill`'s and `RestoreBill`'s checks;
  - `ReserveBillReceiptForAgent`.
- `GetBills` names each write in its refreshes.

**Two scripts:**
- **`bun run mcp:budget <email> [--organization <id or slug>]`**: `serveModule.ts` taking the
  module's name. Claude Code adds it with `claude mcp add strategydance-budget-local -- bun run
  mcp:budget <email>`.
- **`bun run check:budget-module`**, under the backend's `scripts/`, checks the operations'
  conditions against the emulators.

**`createBudgetDatabaseFake`** joins `createModuleDatabaseFake`'s chain, and the tests drive the
module through `createModuleTestKit('budget', caller)`.

**Tests:**
- **Membership and scope:**
  - a removed member's call refused, and one carrying the `createdAt` of a membership since ended;
  - a caller without the write scope refused by every write, nothing written.
- **Idempotency:** a write called twice with one key applied once; one key with other arguments
  refused.
- **`read_budget`:**
  - on the seed scenario, its month, quarter and year matching `summarizeBudgetPeriod`;
  - a past month with nothing expected, and a future one with nothing spent;
  - a member in `Pacific/Auckland` whose today is already the 1st of next month;
  - no budget answering limits as null;
  - a missing rate named.
- **`add_bill`:**
  - an amount with too many decimals refused;
  - a receipt of 701 KB refused;
  - a base64 whose bytes are not its type refused;
  - a text receipt stored as `text/plain`;
  - the answer's status `over` when the bill tips the month.
- **`update_bill`:** a member's save landing in between, the update reading again and reapplying;
  `receipt: null` detaching.
- **Delete and restore:** `delete_bill` then `restore_bill` within a day; a restore after a day
  refused.
- **`list_bills`:**
  - 2000 bills paged at 50 within 50000 characters;
  - a query from an external caller drawing on the search allowance, and one past it answered with
    `toTooManySearchesSentence`;
  - `active` leaving out ended subscriptions.

**CLAUDE.md:**
- Module conventions name the Budget module.
- Commands gain `mcp:budget` and `check:budget-module`.
- Budget conventions say that agents never change the budget itself.

**Verify:**
- From Claude Code over stdio against the emulators:
  - "what is left this quarter?";
  - "add this invoice", with a PDF;
  - "which subscriptions could we cut?".
- `check:budget-module` passes, and the four checks pass.

### M9: The Budget module for external agents

The module served at `https://api.strategydance.com/mcp/budget`, as M20 and M21 served Knowledge
and Tasks.

**Serving it:**
- `SERVED_MODULE_NAMES` gains `budget`, which mounts its endpoint and its protected resource
  metadata, and lets the authorization server and the consent page take it.
- Every write tool registers `scopeChallenge: requireModuleWriteScope(budgetModule)`.
- `list_bills`' query draws on the search allowance, from M8.

**Wording.** The web's `module` catalogue, through `getModuleMessages`, words for members:
- the module's name;
- what read access lets an agent do: "read the budget and the bills, with their receipts";
- what write access lets it do: "add, change and delete bills";
- the agents button's tooltip: "Allow your agents to read and write your budget".

**The button.** `ModuleAgentsButton module="budget"` goes in the page's header, after the settings
button, on every tab.

**Checks.** `check:oauth` reaches the budget's endpoint as it reaches the others.

**Verify:**
- `claude mcp add --transport http strategydance-budget-http-local
  http://localhost:3003/mcp/budget`, then `/mcp` to sign in, and the three questions of M8.
- The consent page and Connected agents word it.
- `check:oauth` and the four checks pass.

### M10: Budget in conversations

Strategy Dance's own agent with the budget, as M16 and M17 gave it knowledge and tasks.

**Before anything else, measure what the tools weigh.**
- The tool list is 16017 tokens since M33, past the 10000 from which Claude's tool search
  (`defer_loading`) can keep tools out of the context.
- Adding the module the usual way changes the pinned tools, which costs every conversation its
  earlier reasoning once, through `drop_block`. Adding it deferred costs none, but adds a search step
  before a tool is first used. conversations.md § Modules, Later modules, says so.
- Count the Budget's tools with `countTokens`, and put both ways to David with their figures. Build
  the one he picks.

**Joining the agent:**
- `CONVERSATION_MODULES` gains `budget`, after `tasks`.
- `delete_bill` joins `SUBAGENT_WITHHELD_TOOLS`.
- `delete_bill` refuses a caller `isReactionCaller` says is a reaction, telling the agent to ask the
  member.

**Receipts from the conversation.** `add_bill` and `update_bill` take `{ attachmentId }` for a caller
with a `launcher`:
- a file the member sent in the conversation calling, or, for a subagent, one its brief names
  (`GetConversationBriefAttachments`);
- copied in Storage to a new receipt of the organization, under a row written first.
- An external caller's `attachmentId` is refused.

**Labels.** The tool labels, running and done, go in the `conversation` catalogue, through
`getConversationToolLabel`, whose test names every tool:
- `read_budget`: "Checking the budget", "Checked the budget";
- and so on for the rest.

**The system prompt** gains a line, only if David wants one: the budget answers spending questions,
and bills can be added from what the member sends. It is pinned by its hash, so changing it is a
release that means to.

**After it lands,** `bun run probe:claude` runs with the new tools, since a list the API refuses
fails every run.

**Tests:**
- the tool lists' pinned bytes moved, or the deferred declaration, whichever David picked;
- a subagent's tools without `delete_bill`;
- a reaction's `delete_bill` refused;
- an attachment of another conversation refused;
- an attachment from a subagent's brief taken;
- the labels' test naming the seven tools.

**CLAUDE.md:** Conversation conventions, A new tool, names the Budget's tools among a module's, and
`delete_bill` among those withheld from subagents.

**Verify:**
- In a browser against the emulators, a conversation asking "Are we over budget this month? Which
  subscriptions could we cut?", as the prototype's thread does, then one sending a PDF with "add
  this as a bill".
- `probe:claude` passes, and the four checks pass.
