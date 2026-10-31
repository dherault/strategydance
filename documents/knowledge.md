# Knowledge

What Strategy Dance knows of companies in general, and what a company does with it:
- **the catalogue**, as data in the knowledge package: proven strategic frameworks, marketing
  tactics and the directories a startup can be submitted to;
- **what the company uses**, an "in use" flag on each item, with the documents, tasks and members it
  involves;
- **the Knowledge module**, through which Strategy Dance's own agent reads the catalogue and keeps
  that state.

It is not the Knowledge module that existed before 2026-10-29, which held the team's documents and is
called Documents now ([conversations.md](conversations.md)). This one is new, and takes the name the
package took on 2026-10-30.

It follows David's brief, "The knowledge module", in Strategy Dance's own documents
(`738bf7e8c35441daa5d12abb34ec2d4b`). The orchestrator's ("The Orchestrator",
`8f15936a553c4eb9a27c9c02aef8fcaa`) lists this module among its prerequisites: an agent that plans a
company's work should build on proven frameworks and on what the company already tried, rather than
on fifteen generic tasks.

This document says how Knowledge works and why. The milestones that build it, each one pull request
into `dev` that a Claude Code session implements, are in
[knowledge-milestones.md](knowledge-milestones.md), with the conventions every one of them follows.

## Decisions

Taken with David on 2026-10-31:

- **Internal only.** The module serves Strategy Dance's own agent alone: its conversations and
  subagents from M3, and the orchestrator's runs once they exist.
  - It is in `MODULES` but not in `SERVED_MODULE_NAMES`, as Subagents is, so `/mcp/knowledge` is
    reserved and answers nothing.
  - There is no page. Nothing in the app shows what the company uses: the agent says it in a
    conversation.
- **The catalogue stays in the package**, shipped with each release, and the module never writes it.
  The database holds only the company's state, keyed by an item's kind and id, which never changes,
  so the state survives a rename.
- **"In use", per company and item**, which the agent sets when the company takes an item up and
  clears when it drops it:
  - a framework is in use while the company works with it;
  - a tactic, while the company runs it;
  - a directory, once the company has submitted to it, whether or not the listing is live yet. The
    task that tracks the submission is linked to it.
- **Links to documents, tasks and members**, several of each per item. The SWOT analysis links to
  the document it lives in, a tactic to the tasks that carry it out and the member who runs it.
- **Read, not dumped.** The brief has the module dump the catalogue into the conversation at once,
  but it is too large: the active directories' JSON alone is 200,504 bytes, four times
  `MAX_TOOL_RESULT_LENGTH` (50,000 characters), and the frameworks' already 42,364. So the agent lists
  compact rows, then reads in full the items it picked.
- **No AI permission of its own.** The catalogue is the same for every company. A link to a document
  follows the document's own permission: the agent links only a document it can read, and never sees
  a link to one the team keeps from AI.
- **Suggestions are out of this plan.** The brief's tool that suggests a new item, and the page where
  Strategy Dance's administrators review suggestions into the repository, come with a later plan.

Left for later:
- **Suggestions and their review.**
- **A page**, from a Claude Design design, where members browse the catalogue and see what the
  company uses.
- **External agents**, at `/mcp/knowledge`. Old `AgentConnection` rows from the Knowledge module that
  is Documents now still carry `module: 'knowledge'` until the daily `PruneUnservedAgentConnections`
  sweeps them, and tokens were bound to that address: before serving it, make sure nothing issued for
  the old module can be accepted.
- **Knowledge in `read_task` and `read_document`**, so the agent sees from a task which tactic it
  carries out.
- **Submitting to directories** through computer use. Until then the agent creates the task, with the
  directory's submission address, and the member submits.

## How it works

### The catalogue

`strategydance-knowledge` holds three lists, each an item kind, `KnowledgeKind` in core:

| Kind | List | Items on 2026-10-31 | What an item holds |
| --- | --- | --- | --- |
| `STRATEGIC_FRAMEWORK` | `STRATEGIC_FRAMEWORKS` | 30 | `description`, `whenToUse`, the `inputs` it needs, the `questions` it asks the founder, in plain words, and its `output` |
| `MARKETING_TACTIC` | `MARKETING_TACTICS` | 49 | `description`, `howTo`, `channel`, `effort`, `paid`, `timeToResults`, `technical` and the `metrics` it is judged by |
| `DIRECTORY` | `DIRECTORIES` | 532, and 184 inactive | `type`, `rootUrl`, `submissionUrl`, `description`, `categories`, `businessModel`, `lastChecked` and `unreachableSince` |

- **Every item has an `id`**, a slug that never changes (`KNOWLEDGE_ID_PATTERN`), and a `name`. An id
  is unique within its kind, so the state is keyed on the kind and the id together.
- **The enums' meanings** are the package's: `MARKETING_TACTIC_CHANNEL_DESCRIPTIONS`,
  `MARKETING_TACTIC_EFFORT_DESCRIPTIONS`, `MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS`,
  `DIRECTORY_CATEGORY_DESCRIPTIONS`, `DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS` and
  `DIRECTORY_INACTIVE_REASON_DESCRIPTIONS`. The agent reads them with an item, never in a tool's
  description, so the tool list does not grow with them.
- **An inactive directory** (`INACTIVE_DIRECTORIES`) takes no submission today. Lists leave it out,
  but it can still be read, set and linked, since the company may have submitted to it before, and a
  later check may bring it back.
- **The lists' rules** are in the package's README: sorted by name, written as `JSON.stringify(list,
  null, 2)` writes them. The directories are kept up to date by their daily check
  ([directories.md](directories.md)).
- **A release ships the lists as they stand.** The backend reads the package when it starts, so the
  agent knows the items of the code it runs.

### What the company uses

Four tables, which only the backend's connector writes, through the module. The browser reads and
writes none of them, so no live query watches them until a page does.

- **`KnowledgeUse`**, keyed `(organization, kind, itemId)`, one row per item the agent ever marked:
  - `isInUse`;
  - `changedAt`, when the flag last changed;
  - `changedBy`, the member the agent acted for, set null when the account goes.

  The row stays when the flag goes back to false, so "stopped using it on 2026-11-02" is told apart
  from "never tried".
- **`KnowledgeDocumentLink`, `KnowledgeTaskLink` and `KnowledgeMemberLink`**, each keyed on the same
  three columns and its target:
  - a `Document`;
  - a `Task`;
  - a membership, `UserOrganization`, through named `@ref` columns, as `AgentConnection` does.

  Each also has `createdAt`. A link needs no `KnowledgeUse` row: a framework can be linked to the
  document it was applied in without being in use.
- **Deletes:**
  - a link goes with its target, by cascade, when the task or the document is pruned, the membership
    removed or the organization deleted;
  - a task or a document deleted within its Undo window keeps its links, which reads skip, as
    `TaskDependency` is read, so a restore brings them back;
  - a row naming an id the release's catalogue no longer has stays, and reads skip it.
- **At most 100 links per item and per target** (`MAX_KNOWLEDGE_LINKS`), counted under the
  organization's lock.
- **The agent's writes record no `ActivityDay`**, as no agent's write does.

### The Knowledge module

`knowledge` in `MODULES`:
- its path is `/mcp/knowledge`, reserved;
- its title is "Strategy Dance Knowledge";
- its scopes are `knowledge:read` and `knowledge:write`.

Its server is `createKnowledgeServer(caller)`, in `src/modules/knowledge/`, with one file per tool, on
`domain/knowledge/`. Like the Tasks module, it carries no AI permission of its own: an agent acting as
a member reads the catalogue and keeps the company's state as that member could.

Its tools, in their frozen order:

| Tool | Input | Answers | Kind |
| --- | --- | --- | --- |
| `list_knowledge` | `{ kind, query?, inUse?, categories?, businessModels?, cursor? }` | the kind's items as compact rows, by name, paged within `KNOWLEDGE_LIST_PAGE_LENGTH` (40,000 characters), and `cursor` while more remain | read |
| `read_knowledge` | `{ kind, ids }`, 10 ids at most (`MAX_KNOWLEDGE_READ_IDS`) | each item whole, its enums' meanings, an inactive directory's reason, the company's `use`, and its links; `missing` names the ids absent from the kind's catalogue | read |
| `set_knowledge_in_use` | `{ kind, id, inUse }` | the item's `use` | write |
| `link_knowledge` | `{ kind, id, documentId?, taskId?, member? }`, exactly one target | the link, with its target's title or name | write |
| `unlink_knowledge` | the same | whether a link was removed | write |

- **`kind`** is one of `KnowledgeKind`, required: every list is for one kind, and an id is unique
  within one alone.
- **A row**, by kind:
  - a framework: `id`, `name`, `description` and `inUse`;
  - a tactic: those, with `channel`, `effort`, `paid`, `timeToResults` and `technical`;
  - a directory: those, with `type`, `categories` and `businessModel`.

  The 30 frameworks and 49 tactics fit one page each. The 532 directories take a few, fewer once
  filtered.
- **`query`** matches every word, case-insensitively, against the name and the description, as
  `list_bills`' does.
- **`inUse`** keeps the items the company uses, or, given false, those it does not, the ones never
  marked among them.
- **`categories` and `businessModels`** keep the directories with one of the categories or models
  given. Either filter with another kind is refused, naming the kind it is for.
- **`cursor`** is the offset where the page stopped, through `encodeCursor` and `decodeCursor`, with
  the query and filters it was read under: a cursor read under others is refused.
- **An item read whole** has every field of its kind, in the package's order, each enum value given as
  `{ value, meaning }`. It also has:
  - `use`: `{ inUse, changedAt }`, or null when the agent never marked it;
  - `documents`, `tasks` and `members`, each the 20 newest links (`MAX_KNOWLEDGE_READ_LINKS`) and the
    total. A document is `{ id, title }`, a task `{ id, name, status }`, a member
    `{ member: "member:<id>", name }`.
- **A link's target** is one of:
  - `documentId`: a document of the organization the agent may read (`isAiReadable`), not deleted;
  - `taskId`: a task of the organization, not deleted;
  - `member`: `"me"` or `"member:<id>"`, as a task's assignee is named, a member of the organization.

  Linking twice keeps one link. Unlinking what is not linked removes nothing, and says so.
- **The writes check the item first**: its id must be one of the release's catalogue for its kind,
  inactive directories included. The operations cannot read the package, so the domain holds them to
  it.
- **Setting the flag it already holds writes nothing**, so `changedAt` keeps the day it last changed.
- **What every module's tool keeps:**
  - an idempotency key per write, under `com.strategydance/idempotencyKey`;
  - `…ForAgent` operations matching the membership on `membershipCreatedAt`, from M2;
  - annotations: `readOnlyHint` on the two reads, `idempotentHint` on all five, no `destructiveHint`,
    since unlinking deletes nothing anybody wrote, and `openWorldHint: false` on all;
  - refusals as sentences;
  - results cut within `MAX_TOOL_RESULT_LENGTH`.
- **What a served module keeps, it does not.** No write takes `requireModuleWriteScope`, a list counts
  on no search allowance, and no page has `ModuleAgentsButton`: that waits for external agents.

### In conversations

- **`CONVERSATION_MODULES` gains `knowledge`**, last, in `MODULES`' order.
- **Subagents get all five tools.** None deletes what anybody wrote, so none joins
  `SUBAGENT_WITHHELD_TOOLS`.
- **The agent's system prompt gains a paragraph** after the budget's:

  > You can read Strategy Dance's knowledge with the knowledge tools: proven strategic frameworks,
  > marketing tactics and directories a startup can be submitted to, and keep track of which ones the
  > company uses. When the member faces a strategic choice, look for a framework that fits and work
  > through its questions with them, one or two at a time, rather than answer from memory. When they
  > look for ways to reach customers, suggest the two or three tactics that best fit their time, money
  > and skills rather than a long list, and for a software product, the directories whose categories
  > match it. List what the company uses before you suggest anything, so you build on what it does
  > rather than suggest it again. When the member takes something up, mark it in use and link it to
  > the documents, tasks and members it involves, and when they drop it, mark that too.

- **The subagent's gains a line:**

  > You can read Strategy Dance's knowledge, its strategic frameworks, marketing tactics and
  > directories, with the knowledge tools, and mark what the company uses or link it to documents,
  > tasks and members when the brief says so.

- **Both prompts name the directories' descriptions among what others wrote.** The catalogue is
  Strategy Dance's, but a directory's description is read from its site by the daily check.
- **Labels.** The `conversation` catalogue words each tool, running and done: "Browsing the
  knowledge", "Reading the knowledge", "Marking what the company uses", "Linking knowledge" and
  "Unlinking knowledge".

### For the orchestrator

The orchestrator's runs reach the module as conversations do, since they run on the same harness.
What a run asks of it:
- read what the company uses before it plans, so it carries on what works and drops what does not;
- reach for a framework when the founder faces a choice, and put its questions to them;
- pick a few tactics, never fifteen, and create the tasks that carry them out, linked to them;
- mark what it hands over as in use, so the next run starts from there.

How the orchestrator decides and when it runs is the orchestrator's plan, not this one.
