# Knowledge: the milestones

| # | Milestone | Packages | Depends on | Implementation PR |
| --- | --- | --- | --- | --- |
| M1 | The Knowledge module, reading the catalogue | core, backend, web | | #288 |
| M2 | What the company uses | database, backend | M1 | |
| M3 | Knowledge in conversations | backend, web, root | M2 | |

The three milestones that build the Knowledge module, each one pull request into `dev` that a Claude
Code session implements, with the conventions every one of them follows. [knowledge.md](knowledge.md)
says how Knowledge works and why, which each milestone reads first: where a milestone finds it wrong,
it corrects knowledge.md in the same pull request. The suggestions the brief describes are not among
them, as David chose on 2026-10-31.

This Knowledge module is not the one conversations-milestones.md's M14, M16 and M20 built, which is
Documents since 2026-10-29.

## Conventions for every milestone

- **Follow `CLAUDE.md`:**
  - a branch from `origin/dev`;
  - granular commits, each green on lint, typecheck, test and build;
  - a pull request into `dev` and the review loop;
  - then a human merges.
- **Read knowledge.md's How it works first**, and conversations.md § Modules for what every module
  keeps. The Subagents module, `src/modules/subagents/`, is the template for a module served to no
  external agent.
- **No `knowledge` catalogue**, since there is no page.
  - The `module` catalogue words the module (M1), and `conversation` its tools' labels (M3).
  - `bun run translate` runs whenever a message changes.
  - No em dash in a message.
- **Backend files:**
  - `modules/knowledge/` and `domain/knowledge/`, apart from `domain/directories/`, which is the
    directories' daily check;
  - no route, since only the module reaches the state.
- **The catalogue is read, never written.** The module imports the package's lists. A change to a
  list is a change to the package, under its README's rules, in a pull request of its own.
- **Data Connect, from M2, as the database's `CLAUDE.md` says:**
  - a mutation writes each row once;
  - backend operations take `$userId` and `$membershipCreatedAt`, and check them against the rows;
  - each milestone adds the tables, fields and operations it is the first to use.
- **CI runs without emulators.**
  - Domain tests mock `strategydance-database/backend` with `mock.module`.
  - The SQL conditions are checked by hand against the emulators by `bun run check:knowledge-module`
    (M2), never by a `*.test.ts`.
- **A milestone that sets a convention later sessions must follow** adds it to the backend's
  `CLAUDE.md`, under a `## Knowledge` section that M2 starts. The root's stays as short as it is.
- **Every milestone ends with the four checks green.** Its **To verify** list is what its session
  runs before handing the pull request over, and the pull request says how each went.

## Milestones

M1, M2 and M3 go in order. Each one's tools build on the one before. M3 alone changes what a
conversation sends, so the agent's tool list changes once, with the five tools.

### M1: The Knowledge module, reading the catalogue

The catalogue as Strategy Dance's fifth module, read-only. Nothing in the app calls it yet, and Claude
Code reaches it locally over stdio.

**The frame:**
- **`MODULES` gains `knowledge`**, after `subagents`, with a comment as Subagents' says: served to no
  external agent, its address reserved. `SERVED_MODULE_NAMES` stays as it is.
- **Core gains `KnowledgeKind`**: `STRATEGIC_FRAMEWORK`, `MARKETING_TACTIC` and `DIRECTORY`, a const
  object as core's enums are. M2 mirrors it in the schema.
- **`MODULE_SERVERS` gains `createKnowledgeServer`.**
  - `moduleServers.test.ts` checks its tool names against the other modules', and lists its two.
  - `createModuleAddresses` takes nothing: nothing of the module has an address.
- **`routes/modules.test.ts` checks that `/mcp/knowledge` and its protected resource metadata answer
  404**, as the Subagents module's test does.
- **The web's `module` catalogue words it.**
  - `getModuleMessages` is typed over every `ModuleName`, so a module in `MODULES` fails the typecheck
    until it is worded.
  - `knowledgeName` is "Knowledge". `knowledgeReadAccess` is "Read Strategy Dance's strategic
    frameworks, marketing tactics and directories, and what your company uses of them."
    `knowledgeWriteAccess` is "Mark what your company uses, and link it to documents, tasks and
    members." `knowledgeAgentsButton` is "Allow your agents to use Strategy Dance's knowledge".
  - `getModuleMessages`' comment on the budget, served to external agents since budget-milestones.md's
    M9, is corrected while there.

**`src/modules/knowledge/`**, as the Subagents module's:
- `knowledgeModule.ts`, its entry in `MODULES`.
- `createKnowledgeServer.ts`, with short `INSTRUCTIONS`: what the catalogue is, and to list before
  suggesting.
- `knowledgeTools.ts`, the frozen order: `list_knowledge`, `read_knowledge`. M2 appends the writes.
- `knowledgeSchemas.ts`:
  - the kind;
  - an id held to `KNOWLEDGE_ID_PATTERN`;
  - the directory filters, from the package's enums;
  - a row and an item per kind, for the `outputSchema`s.
- `toKnowledgeRefusal.ts`.
- `tools/registerListKnowledge.ts` and `tools/registerReadKnowledge.ts`, with `readOnlyHint`,
  `idempotentHint` and `openWorldHint: false`.

**`domain/knowledge/`:**
- `listKnowledge` and `readKnowledge`, one per tool;
- `readKnowledgeCatalogue`, the package's list for a kind, with the inactive directories apart;
- `toKnowledgeRow`, an item as a list shows it;
- `toKnowledgeItem`, an item whole, its enum values with their meanings;
- `matchesKnowledgeQuery`, every word in the name or the description, whatever its case.

**Constants**, in the backend's `constants.ts`: `KNOWLEDGE_LIST_PAGE_LENGTH`, 40,000 characters, as
`TASK_LIST_PAGE_LENGTH` is, and `MAX_KNOWLEDGE_READ_IDS`, 10.

**No database yet.** The catalogue is the same for every organization and the caller arrives
verified, so M1 reads nothing: rows carry no `inUse`, and items no `use` or links, until M2.

**Tests:**
- **`list_knowledge`:**
  - each kind's rows, with their kind's fields alone, by name;
  - a query of two words, matching in the name or the description, whatever their case;
  - `categories` and `businessModels` keeping the directories with one of those given;
  - either filter with another kind refused, naming the kind it is for;
  - the 532 directories paged within 40,000 characters, every one once, and a page whose every
    character JSON escapes cut short;
  - a cursor read under another query refused.
- **`read_knowledge`:**
  - every field of each kind, in the package's order;
  - each enum value with its meaning;
  - ids absent from the kind's catalogue named in `missing`, a framework's id read as a tactic among
    them;
  - an inactive directory, with its reason;
  - eleven ids refused, and an id given twice answered once.

**CLAUDE.md:** the backend's file names knowledge.md among the documents to read, beside
conversations.md and budget.md.

**To verify, once implemented:**
- Over stdio, from Claude Code (`claude -p` with a scratch `--mcp-config` running
  `bun scripts/serveModule.ts knowledge <email>` against the emulators), with no `mcp:knowledge`
  script, since no member adds the module:
  - "Which framework helps me decide what to build next?", answered from `list_knowledge` and
    `read_knowledge`;
  - "Which free directories list developer tools?", answered from the directory filters.
- The four checks.

### M2: What the company uses

The company's state, the four tables of What the company uses, and the three tools that write it.

**The schema:**
- `enum KnowledgeKind`, its values core's, in their order, which `schema.test.ts` holds to core's.
- **`KnowledgeUse @table(key: ["organization", "kind", "itemId"])`:**
  - `organization: Organization!`, cascade deleting;
  - `kind: KnowledgeKind!` and `itemId: String!`;
  - `isInUse: Boolean!`;
  - `changedAt: Timestamp!`;
  - `changedBy: User`, set null when the account goes.
- **`KnowledgeDocumentLink`, `KnowledgeTaskLink` and `KnowledgeMemberLink`**, each keyed on
  `organization`, `kind`, `itemId` and its target, with `createdAt`:
  - `document: Document!` and `task: Task!`, cascade deleting;
  - `membership: UserOrganization!`, through named `@ref` columns, as `AgentConnection` does, cascade
    deleting.
- Nothing is dropped, so the release's migration is additive and does not stop.

**Backend-connector operations**, each matching the membership on `membershipCreatedAt`:
- **Reads:**
  - `GetKnowledgeUsesForAgent`: a kind's uses, for `list_knowledge`'s `inUse`;
  - `GetKnowledgeItemsForAgent`: for the ids read, their uses and their links, each list the 20
    newest with its count. Documents are those the agent may read, and documents and tasks are
    filtered on `deletedAt`. A membership has none: its links go with it.
- **Writes**, each an `@transaction` inserting its `ModuleCallResult` under
  `@include(if: $isKeyed)`:
  - `SetKnowledgeInUseForAgent`, an upsert writing `changedAt` and `changedBy`;
  - `LinkKnowledgeDocumentForAgent`, `LinkKnowledgeTaskForAgent` and `LinkKnowledgeMemberForAgent`:
    each locks the organization's row, holds its target to the organization under its checks, the
    document also to `isAiReadable` and both to `deletedAt`. A link already there is answered as it
    is, and counts nothing. A new one is counted with the item's links in its own table, its
    documents, tasks or members, under `MAX_KNOWLEDGE_LINKS`, 100, before its insert;
  - `UnlinkKnowledgeDocumentForAgent`, `UnlinkKnowledgeTaskForAgent` and
    `UnlinkKnowledgeMemberForAgent`, each a `deleteMany` answering its count.
- The operations cannot read the package: the domain holds every id to the catalogue before it calls
  one.

**The three write tools**, appended to the frozen order:
- `set_knowledge_in_use`, `link_knowledge` and `unlink_knowledge`, each through
  `readKnowledgeWriteCall` and `toKnowledgeWriteResult`, as `readSubagentsWriteCall` and
  `toSubagentsWriteResult`;
- no `scopeChallenge`, since no external agent reaches them;
- `idempotentHint`, and no `destructiveHint`.

**The reads gain the state.**
- Every call reads the membership first, and refuses a removed member.
- `list_knowledge`'s rows gain `inUse`, and its input the `inUse` filter.
- `read_knowledge`'s items gain `use`, `documents`, `tasks` and `members`, under
  `MAX_KNOWLEDGE_READ_LINKS`, 20.

**`createKnowledgeDatabaseFake`** keeps the four tables, the documents', tasks' and members' rows they
read, and joins `createModuleDatabaseFake`'s chain. It mirrors the operations
`check:knowledge-module` runs.

**`bun run check:knowledge-module`**, `scripts/checkKnowledgeModule.ts`, checks the operations'
conditions against the emulators:
- a stale membership refused;
- another organization's document, task and member refused;
- a document kept from AI, and a deleted document and task, refused;
- the 101st link refused;
- the links gone once their task is pruned and their member removed.

**Tests:**
- **Membership and idempotency:** a removed member's call refused, and one carrying the `createdAt` of
  a membership since ended; a write called twice with one key applied once; one key with other
  arguments refused.
- **`set_knowledge_in_use`:**
  - set, then cleared, the row kept with its `changedAt`;
  - set again to what it holds, nothing written, `changedAt` kept;
  - an id absent from the kind's catalogue refused, nothing written, and an inactive directory set.
- **`link_knowledge` and `unlink_knowledge`:**
  - each target linked, then unlinked, and linking twice keeping one;
  - `"me"` and `"member:<id>"`, and a member of another organization refused;
  - a document kept from AI refused with a sentence the agent can act on;
  - a deleted task refused;
  - the cap: an item's 101st task link refused while a document and a member can still be linked to
    it, one of its 100 tasks linked again answered without a refusal, and one task linked to 101
    items accepted;
  - unlinking what is not linked answering that nothing was removed.
- **The reads:**
  - `inUse` keeping the items in use, and false keeping the rest, those never marked among them;
  - a link to a document since kept from AI left out, its total too;
  - a deleted task's link skipped, then read again once the task is restored;
  - a row naming an id absent from the catalogue skipped.

**CLAUDE.md:** the backend's file starts `## Knowledge`:
- the catalogue is the package's as of the release, and the module never writes it;
- the state is keyed by kind and id, and an id the catalogue lost is skipped;
- links follow the documents' AI permission;
- `check:knowledge-module` joins the scripts' `check:<area>` row.

**To verify, once implemented:**
- `check:knowledge-module` against a scratch suite on the branch's schema.
- Over stdio, from Claude Code as M1's verification does:
  - "We started cold emailing last week, the task for it is <name>", which marks the tactic in use and
    links the task;
  - "What marketing are we doing?", answered from `list_knowledge` with `inUse`.
- The four checks.

### M3: Knowledge in conversations

Strategy Dance's own agent with the knowledge, as budget-milestones.md's M10 gave it the budget.

**Measured first.** The five tools, converted as the worker sends them, in characters and their
tokens estimated, the list before and after, go in the pull request's description. M10 found that
Claude's tool search would cost existing conversations their earlier reasoning as the tools do, so
they join the list as the other modules' did, unless David chooses otherwise.

**Joining the agent:**
- `CONVERSATION_MODULES` gains `knowledge`, last, in `MODULES`' order.
- None of the five joins `SUBAGENT_WITHHELD_TOOLS`, since none deletes what anybody wrote.
- The tool lists' pins move, names and hashes, in `buildConversationTools.test.ts`,
  `buildSubagentTools.test.ts` and `connectConversationModules.test.ts`, whose read-only runners gain
  `list_knowledge` and `read_knowledge`.

**The system prompts.**
- The agent's gains knowledge.md's paragraph after the budget's.
- The subagent's gains knowledge.md's line after the budget's.
- Both name the directories' descriptions among what others wrote.
- Both pinned hashes move, and their tests still refuse an em dash.

**Labels.** The `conversation` catalogue words the five, running and done, in `TOOL_LABELS`:
"Browsing the knowledge", "Reading the knowledge", "Marking what the company uses", "Linking
knowledge" and "Unlinking knowledge", with `getConversationToolLabel.test.ts` naming them.

**conversations.md § Modules** lists Knowledge fifth, served to no external agent, and points at
knowledge.md, in place of the directories and marketing tactics it says David has in mind next.

**Tests:**
- the tool lists' pinned bytes moved, a subagent's with the five;
- the labels' test naming the five.

**CLAUDE.md:** the backend's `## Knowledge` says Strategy Dance's agents reach the module from M3.

**To verify, once implemented:**
- `bun run probe:claude`, which sends the new list to the API and counts the tools exactly.
- Through `dev:backend` on the real model, by `send:conversation`, capped at $3 in all:
  - "Which framework should I use to price my product?", working through its questions;
  - "Where should I list my developer tool?", naming a few directories whose categories match;
  - "We now answer questions on Reddit twice a week, keep track of it", marking the tactic in use and
    linking the task it creates.
- In a browser, against the backend with a scripted Claude client, the five labels drawn at desktop
  and phone widths.
- The four checks.
- **Left for David:** the release that ships M3 costs every conversation its earlier reasoning once,
  as every change of the tools does, so it ships when that is meant.
