import type { MODULES } from './constants'
import type { Currency } from './enums'

/*
  The envelope every backend response is wrapped in, success and failure alike. Declared here
  because the backend writes it and the web app reads it, and a copy on each side would drift
*/

export type ApiSuccessResponse<T = void> = {
  status: 'success'
  data?: T
}

export type ApiErrorResponse = {
  status: 'error'
  code: string
  message: string
}

export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse

/* ---
  ORGANIZATIONS
--- */

/*
  Why an address was not invited: taken by another invitation or a membership in the meantime,
  no room left in the team, the inviter no longer administering it, or a failure on the server's
  side
*/
export type InvitationFailureReason = 'taken' | 'full' | 'forbidden' | 'error'

// What inviting people to an organization answers with: who was invited, and who was not and why.
// Some can go out while others do not, since each address is inserted on its own
export type InviteOrganizationMembersData = {
  invitedEmails: string[]
  failedEmails: {
    email: string
    reason: InvitationFailureReason
  }[]
}

// Which of an organization's pictures a request is about
export type OrganizationImageKind = 'logo' | 'banner'

// What uploading or removing one of an organization's pictures answers with: its URL now, null
// once removed
export type ChangeOrganizationImageData = {
  url: string | null
}

// What uploading a picture for a document's text answers with: where it is downloaded from
export type RichTextImageData = {
  url: string
}

/*
  The edits a conversation's agent made to documents that an Undo can still take back, nobody
  having written to their document since: each revision's id, the key of the call that made it,
  Claude's id for the call, by which the thread finds its row, and its document
*/
export type UndoableDocumentRevisionsData = {
  revisions: { id: string; callKey: string; documentId: string }[]
}

/*
  What going back to a version of a document answers with: the revision the restore kept of the
  text it replaced, which an Undo of the restore goes back to, or null when the text read as the
  version already and nothing was written
*/
export type RestoreDocumentRevisionData = {
  revisionId: string | null
}

/*
  What a web page says of itself, as a link preview card in a document draws it: the address it
  was asked for, and whatever the page names of its title, its description, its site and its
  picture, each left out when it names none. A page that could not be read is its address alone
*/
export type LinkPreviewData = {
  url: string
  title?: string
  description?: string
  siteName?: string
  /** An https picture on the page's own site or elsewhere, which the card loads from there */
  imageUrl?: string
}

/* ---
  CONVERSATIONS
--- */

/*
  A conversation's entry, as `buildConversationPreview` reads it: the columns of a
  `ConversationMessage` row, by their names, so a row read back from the database goes in as it
  is. String literals rather than the schema's enums, which this package cannot import: the
  generated SDK's values are assignable to them, so a value the schema gains and these lack fails
  to typecheck wherever a row is passed
*/
export type ConversationPreviewSource = {
  kind: 'MEMBER_TEXT' | 'AGENT_TEXT' | 'TOOL_CALL' | 'QUESTION' | 'ASPECTS' | 'NOTE' | 'APPROVAL' | 'BRIEF'
  text?: string | null
  toolName?: string | null
  toolStatus?: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | null
  // A call to an integration's, a tool call or an approval: the server's name and the tool's, as
  // they were at call time, and an approval's state
  integrationName?: string | null
  integrationToolName?: string | null
  approvalState?: 'PENDING' | 'ALLOWED' | 'DENIED' | null
  questionPrompt?: string | null
  answerSelected?: string[] | null
  answerOther?: string | null
  isAnswerSkipped?: boolean | null
  noteKind?: 'STOPPED' | 'FAILED' | 'REFUSED' | 'INTERRUPTED' | 'FULL' | null
  // A failed note's daily spend ceiling, when one stopped the run: whose, and when it has room again
  ceilingScope?: ConversationSpendCeilingScope | null
  ceilingFreesAt?: string | null
  // The files a member's message sends, in the order it sends them, as the reverse relation reads them
  conversationAttachments_on_message?: { name: string }[] | null
}

/*
  What `Conversation.preview` holds: the facts of the last entry the list shows, never its words.
  A text keeps up to `MAX_CONVERSATION_PREVIEW_LENGTH` characters of plain text, and a question
  its prompt, or once answered the answer
*/
export type ConversationPreview =
  | {
      kind: 'MEMBER_TEXT' | 'AGENT_TEXT'
      text: string
      // A member's message that sends files: how many, and the first one's name, which the list
      // shows when the message holds no text
      attachmentCount?: number
      attachmentName?: string
    }
  | {
      kind: 'TOOL_CALL'
      toolName: string
      toolStatus: NonNullable<ConversationPreviewSource['toolStatus']>
      // A call to an integration: the server it went to, which the list names, "Called Stripe"
      integrationName?: string
    }
  | {
      kind: 'APPROVAL'
      integrationName: string
      integrationToolName: string
      approvalState: NonNullable<ConversationPreviewSource['approvalState']>
      // Where the call stands once allowed, null until a run starts it
      toolStatus: ConversationPreviewSource['toolStatus']
    }
  | {
      kind: 'QUESTION'
      questionState: 'WAITING' | 'ANSWERED' | 'SKIPPED'
      text: string
    }
  | {
      kind: 'NOTE'
      noteKind: NonNullable<ConversationPreviewSource['noteKind']>
      // The daily spend ceiling that stopped the run, on a failed note; absent from any other, and
      // from a preview written before M39, which a page draws as the failed note
      ceiling?: ConversationSpendCeiling
    }

// Whose daily spend ceiling stopped a run: the member's in the organization, the account's across
// its organizations, or the organization's
export type ConversationSpendCeilingScope = 'MEMBER' | 'ACCOUNT' | 'ORGANIZATION'

// The ceiling a failed note names, and when it has room again, in RFC 3339
export type ConversationSpendCeiling = {
  scope: ConversationSpendCeilingScope
  freesAt: string
}

/*
  What `ConversationMessage.citations` holds on a reply that cites the web: each cited span, by its
  offsets in the message's `text`, with the sources web search gave for it, their address, title and
  the words quoted from them. The backend writes it as it draws the reply, and the thread draws a
  numbered link after each span and the sources under the reply
*/
export type ConversationCitation = {
  start: number
  end: number
  sources: {
    url: string
    title: string | null
    citedText: string
  }[]
}

// A member's answer to a question: the options they chose, by their text, and their own words
export type ConversationAnswer = {
  selected: string[]
  other: string | null
}

// Whether an answer fits its question, as `checkConversationAnswer` reads it: the answer as it is
// recorded, its options in the question's order and its own words trimmed, or why it does not
export type ConversationAnswerCheck =
  | { outcome: 'valid'; answer: ConversationAnswer }
  | { outcome: 'invalid'; reason: string }

// What answering a question answers with: the run that carries the conversation on once every
// question of its turn is answered, or null while another still waits, or while the member has as
// many runs going as they may, when the page's reconcile starts it later
export type AnswerConversationQuestionData = {
  runId: string | null
}

/*
  What deciding on a call waiting for the member's approval answers with: the run that carries the
  conversation on, as an answer's does, and whether an Allow was denied instead because the server,
  the tool or the account changed since the call was proposed, which the page says, the agent
  proposing it again
*/
export type AnswerConversationApprovalData = {
  runId: string | null
  isChanged: boolean
}

// What sending a message answers with: the run it started, or the one a send retried with the same
// message's id started the first time
export type SendConversationMessageData = {
  runId: string
}

// What uploading a file to a conversation answers with, the first time and every time the same
// upload is sent again: the file as it was stored, its pages counted when it is a PDF
export type ConversationAttachmentData = {
  id: string
  name: string
  contentType: string
  size: number
  pageCount: number | null
}

// What resuming a stopped or interrupted run answers with: the run that carries it on, or the one a
// resume sent again started the first time
export type ResumeConversationRunData = {
  runId: string
}

// What retrying a run that ended with a note answers with: the run that answers its member's entry
// again, or the one a retry sent again started the first time, and the runs whose messages went,
// which the page drops from every page of the thread it holds
export type RetryConversationRunData = {
  runId: string
  removedRunIds: string[]
}

/*
  How much of the member's conversations a search covered:

  - `ALL`: every conversation whose title or one message holds every word
  - `BEST_MATCHES`: the most relevant matches, once the messages read ran out before the
    conversations did, when a narrower search finds the rest
  - `RECENT`: a search by substring, for Chinese or Japanese, which reads every title but only the
    messages of the most recently active conversations
*/
export type ConversationSearchCoverage = 'ALL' | 'BEST_MATCHES' | 'RECENT'

// What searching conversations answers with: the matching conversations' ids, in no particular
// order, since the page already holds the conversations and keeps its own, and how far it looked
export type SearchConversationsData = {
  conversationIds: string[]
  coverage: ConversationSearchCoverage
}

/* ---
  TASKS
--- */

/*
  What the board's helpers read of a task: its id, whether it is done, and the ids of the tasks it
  waits on. Plain rather than a row of the database's, so the page and the backend count the same
  from what each of them reads
*/
export type TaskLinks = {
  readonly id: string
  readonly isDone: boolean
  readonly dependencyIds: readonly string[]
}

/* ---
  MODULES
--- */

// One of `MODULES`: what a module is called, where it is served, what MCP clients show for it, and
// the scopes a consent to it grants
export type ModuleDefinition = {
  readonly name: string
  readonly path: string
  readonly title: string
  readonly scopes: {
    readonly read: string
    readonly write: string
  }
}

// The name of one of `MODULES`
export type ModuleName = (typeof MODULES)[number]['name']

// A scope one of `MODULES` grants
export type ModuleScope = (typeof MODULES)[number]['scopes'][keyof ModuleDefinition['scopes']]

/*
  What the consent page reads of an authorization request an external agent made: who is asking,
  where the member will be sent back, the module and the access asked for. A registered client is
  unverified, since nothing proves who registered it; a client ID metadata document's is verified,
  and its domain is the document's. The name is the client's own, stripped of control and
  direction characters and cut short, and never comes with a logo, which would load an address of
  the client's choosing
*/
export type OAuthAuthorizationRequestSummary = {
  client: {
    name: string | null
    isVerified: boolean
    domain: string | null
  }
  redirectHost: string
  // A loopback address, which any program on the member's computer could be listening on
  isLoopbackRedirect: boolean
  module: ModuleName
  scopes: ModuleScope[]
  expiresAt: string
}

// Where the consent page sends the browser once the member allowed or denied a request: back to
// the client, or nowhere when the client could not be verified
export type OAuthAuthorizationDecision = {
  redirectUrl: string | null
}

/* ---
  INTEGRATIONS
--- */

/*
  A tool an MCP server listed, as `OrganizationIntegration.tools` keeps it: what the server said of
  it, read through the MCP SDK's own schema, and the hash of its definition an administrator's
  approval is bound to, so a server that changes a tool loses the approval given to the old one.
  Every text in it is the server's, shown as plain text and never as Markdown
*/
export type IntegrationTool = {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
  annotations?: {
    title?: string
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
  definitionHash: string
}

// What adding a server answers with: its id, and how many tools it listed, none for an OAuth server
// until a member connects an account
export type AddIntegrationData = {
  integrationId: string
  toolCount: number
}

/*
  What starting a Connect answers: the address of the authorization server's sign-in, which the page
  opens in the window it opened for it, an https one alone, and the Connect's id, which a Cancel names,
  so it cancels that Connect and never one started since
*/
export type StartIntegrationConnectionData = {
  authorizationUrl: string
  authorizationId: string
}

/*
  What came back to Strategy Dance's callback from an OAuth server's sign-in: a code, which the
  member's page finishes, the member's refusal, or nothing it could use, an unknown or spent sign-in
  included
*/
export type IntegrationAuthorizationOutcome = 'received' | 'denied' | 'failed'

// The query the callback sends the browser to `INTEGRATION_CONNECTED_PATH` with, the ids hyphenated,
// each present when the sign-in it came back from was known
export type IntegrationConnectedSearch = {
  outcome: IntegrationAuthorizationOutcome
  organization?: string
  integration?: string
  authorization?: string
}

/*
  What the page a sign-in ends on says to the window that opened it, on
  `INTEGRATION_CONNECTION_CHANNEL`: which server and which Connect, when it knows, and how it went,
  with the backend's error code when it failed. A window waiting on a Connect takes a failure or a
  refusal for that Connect alone, so an older sign-in coming back late never ends a newer one. Anybody
  can open that page with a made-up query, so it takes `connected` as a nudge to look, and only the
  member's live connection as the proof
*/
export type IntegrationConnectionMessage = {
  integrationId: string | null
  authorizationId: string | null
  outcome: 'connected' | 'denied' | 'failed'
  code: string | null
}

/* ---
  BUDGET
--- */

// How long a budget's amount is meant to last: `schema.gql`'s `BudgetPeriod`, which core cannot
// import. The SDK's enum passes for it, since each of its values is the same string
export type BudgetPeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

// How often a recurring bill is paid again: `schema.gql`'s `BillRecurrence`, as `BudgetPeriod` is
export type BillRecurrence = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

/*
  When a bill is paid, its days `YYYY-MM-DD`: on `paidOn`, and, when it recurs, again each period
  counted from that day, until `endsOn` when it has one
*/
export type BillSchedule = {
  readonly paidOn: string
  readonly recurrence: BillRecurrence | null
  readonly endsOn: string | null
}

/*
  What the budget's computations read of a bill, its amount in minor units of its own currency.
  Plain rather than a row of the database's, so the page and the module compute the same numbers
  from what each of them reads, the `Int64` turned into a number at the edge
*/
export type BudgetBill = BillSchedule & {
  readonly id: string
  readonly name: string
  readonly company: string
  readonly amountMinor: number
  readonly currency: Currency
}

/*
  A row of `ExchangeRateYear`: one currency's rates for one calendar year, the JSON text of an
  object from each ECB day, `YYYY-MM-DD`, to the units of the currency one euro bought that day
*/
export type ExchangeRateYearRow = {
  readonly currency: Currency
  readonly year: number
  readonly rates: string
}

// Each currency's ECB days, sorted, beside the rate of each, as `buildExchangeRateTable` reads them
export type ExchangeRateTable = ReadonlyMap<
  Currency,
  {
    readonly days: readonly string[]
    readonly rates: readonly number[]
  }
>

// The budget an administrator set: an amount, in minor units of the currency the Budget computes
// in, meant to last a month, a quarter or a year
export type BudgetLimit = {
  readonly amountMinor: number
  readonly period: BudgetPeriod
}

// What a stretch of days pays, in minor units: on or before today, and after it
export type BudgetSpending = {
  spent: number
  expected: number
}

// Which of today's periods a budget is held to, after the period it was set for
export type BudgetScope = 'month' | 'quarter' | 'year'

/*
  Where spending stands against the budget in its own period: over once what was spent passes the
  limit, warned once what is still expected would take it past, and by how much, with the limit and
  what is expected
*/
export type BudgetStatus = {
  level: 'over' | 'warn'
  scope: BudgetScope
  by: number
  limit: number
  expected: number
}

/*
  What the Budget page draws, every amount in minor units of the currency it computes in: this
  month, quarter and year, next month, each month of the year, the recurring bills next month pays,
  the limits, the status, and the same stretches before, to compare with. `missingRates` names the
  currencies a payment could not be converted from or to, which the sums leave out
*/
export type BudgetSummary = {
  month: BudgetSpending
  quarter: BudgetSpending
  year: BudgetSpending
  next: number
  months: (BudgetSpending & { isCurrent: boolean })[]
  recurringCount: number
  monthlyLimit: number | null
  yearlyLimit: number | null
  status: BudgetStatus | null
  previous: {
    monthToDate: number
    yearToDate: number
    lastYear: number
  }
  missingRates: Currency[]
}

/*
  A month, a quarter or a year against the budget, as the Budget module's `read_budget` answers it:
  its first and last days, what it paid and still expects relative to today, its share of the
  budget, and what is left of it once what was spent, then also what is expected, is taken off
*/
export type BudgetPeriodSummary = BudgetSpending & {
  from: string
  to: string
  limit: number | null
  left: number | null
  projectedLeft: number | null
}

// A month, its quarter and its year against the budget, and the currencies left out
export type BudgetPeriodsSummary = {
  month: BudgetPeriodSummary
  quarter: BudgetPeriodSummary
  year: BudgetPeriodSummary
  missingRates: Currency[]
}

// A payment still to come, converted, or null when its currency has no rate
export type UpcomingBillPayment<T extends BudgetBill = BudgetBill> = {
  bill: T
  day: string
  amountMinor: number | null
}

// What a company was paid, converted, under the name its latest bill spells it with
export type CompanySpending = {
  company: string
  amountMinor: number
}
