# One address for the modules

Strategy Dance serves each module an external agent may use at an address of its own: Documents at
`https://api.strategydance.com/mcp/documents`, Tasks at `…/mcp/tasks` and Budget at `…/mcp/budget`,
each its own OAuth resource ([conversations.md](conversations.md) § Modules). A member who gives
Claude Code all three adds three servers, consents three times, ticks their organizations three
times and finds three rows on Connected agents, and the client reads the same introduction and the
same list of organizations three times over. Each module served later adds one more of each.

This plan serves every module at one address, `https://api.strategydance.com/mcp`: one OAuth
resource whose scopes stay the modules' own, so a member connects an agent once and chooses there
what it may do in each module. It answers David's question of 2026-11-07, whether to merge the
servers into one that handles both Strategy Dance's agent and external ones.

The milestones that build it close the document, each one pull request into `dev` that a Claude
Code session implements. Each reads this document first and, where it finds it wrong, corrects it in
the same pull request.

## Why

- **The permissions are one already.** Every module goes through one handler, `createModuleHandler`,
  built from one `ModuleAccess`:
  - Strategy Dance's agent's, `kind: 'agent'`: every scope, in its run's organization, with a
    `launcher` once a worker has claimed the run;
  - an external agent's, `kind: 'external'`: its token's scopes, in the organizations its connection
    reaches, every call naming its `organization`.

  What is split is the transport and OAuth: an address, a resource, a connection and a consent per
  module.
- **Tool names are unique across modules already**, since Strategy Dance's agent sends them all in
  one list, and a test fails on a clash. One server needs nothing more: the SDK's `McpServer`
  refuses a name registered twice, and lists its tools in the order they were registered.
- **It is how products serve MCP.** A company's remote MCP server is usually one per product, its
  tools chosen by what the member allows:
  - GitHub serves one endpoint, picking its toolsets and a read-only mode by path or header;
  - Linear, Notion and Atlassian each serve one address;
  - companies split by product, or by trust boundary.

  The advice on tool counts, 5 to 15 tools a server, is about what a client loads, which a list
  that follows the member's choices keeps small: the three modules are 23 tools.
- **Strategy Dance's boundary is the member and the organization**, which one resource keeps: the
  scopes per module, the `organization` every call names, the AI permissions and the membership
  fence.
- **What a server per module was for holds within one consent.** conversations.md § Modules keeps a
  server per module so a member connects modules one by one, and so a module that touches money asks
  for its own consent. Budget is that module. One consent still sets each module apart, and Budget's
  writes start unchosen there unless the member chose them before for the same client (Decisions),
  so bills are written only by a choice of the member's own.
- **Now is when it costs least**: before the MCP Registry lists anything, one entry rather than
  three, and while few members have connected agents.

It does not change what Strategy Dance's agent sees, serve Knowledge or Subagents to external
agents, or touch integrations, which are other companies' servers.

## Decisions

Proposed on 2026-11-07 and built in M1 to M3. The review of 2026-11-10 (Review of 2026-11-10,
below) changed two, as each says:

- **One address, `/mcp`.** Its server is named `strategydance` and titled "Strategy Dance", one
  OAuth resource whose `scopes_supported` are the served modules' scopes. In Claude Code, `claude
  mcp add --transport http strategydance https://api.strategydance.com/mcp`.
- **Access per module, on one consent.**
  - For each module the client asks for, the member chooses not allowed, read, or read and write
    when the client asked for write.
  - The organizations are ticked once, for every module. A member who wants Budget in one
    organization and Documents in two connects a second client, where a connection per module told
    them apart.
  - At least one module is allowed.
  - A client naming no scope asks for every served module, read and write, as a request naming
    none asks for both today.
  - **Budget's writes take the member's choice.** At the one address, Budget starts at read unless
    the client asks for its write and the connection replaced held it, a choice the member made
    before for that client. Many clients ask for every scope a server lists, so otherwise one click
    on Allow would let an agent add, change and delete bills beside writing documents, and a held
    write is never carried over to a request that did not ask for it. A later module that touches
    money starts the same way. `/mcp/budget` is the consent of its own conversations.md meant, and
    stays as it is.
  - **Consenting again starts as the connection holds.** At the one address, a consent replacing
    a connection starts each module as the connection holds it: a module not held starts not
    allowed, a write held at read at read, and what the agent asks beyond it is offered, never
    chosen. What a connection holds cannot tell what the member left out from what the agent never
    asked for, and an agent asks again whenever a write is challenged, as does every client once
    its refresh token expires, most asking for every scope. Before the review of 2026-11-10 a module
    started as asked when that was more, so one click on Allow undid a narrowing, on an earlier
    consent or through Access. A first consent starts each module as asked.
  - So widening is the member's own choice on the page. A write's challenge, or a client asking
    for a module the connection lacks, finds it offered and unchosen, as Budget's write always has
    been, the option the agent asked for marked "Asked for" so the member sees why it sent them. An
    Allow left as the page starts it grants nothing new, and the agent's next call asks again.
- **The tools follow the access.**
  - A connection lists the tools of each module it holds the read scope of, and none of a module it
    does not: a member who left Budget out finds no bill tool in their agent.
  - The write tools of a module held read only stay listed and challenged, as today.
  - A call to a tool of a module the connection does not hold, from a client that listed it before
    a consent or Access took the module away, is challenged for that module's read, as a write is
    for its write, rather than answered that no such tool exists.
  - Adding a module is consenting again.
- **Consenting again keeps what the connection held.** The consent page lists each module the
  connection it replaces holds beside those the client asks for, held as they were, so a client
  that asks for Tasks alone keeps Documents unless the member unticks it. The token's answer names
  every scope granted, as OAuth asks when they differ from those asked for (RFC 6749, 3.3).
- **The idempotency scope outlives a consent.** Allow still replaces a connection by deleting it and
  inserting another, so a code, a refresh token or a revocation read before a consent finds nothing
  to act on after it. At the one address, an external agent's idempotency scope comes from what a
  consent keeps rather than the connection's id: the member's account, the client and the address.
  A write whose answer was lost while the member consented again is then found under its key, rather
  than applied twice, while the connection keeps that module's write: a write's scope is checked
  before its key, so a consent that took the write away answers the retry with the read-only
  refusal. The per-module addresses keep `connection:<id>` until they retire, so no write in flight
  across M2's release changes scope.
- **One connection per client.** `AgentConnection.module` holds the address's name, `strategydance`
  for the one address. A connection there is a row beside the per-module ones, with no change to the
  schema and nothing for a release to stop on.
- **The per-module addresses stay through a transition**, serving as they do, while Connected agents
  points their rows to the one address. A later release retires them, when David chooses.
- **The rate limit stays 600 calls in ten minutes per connection**, across its modules. It bounds one
  agent's loop, and an agent calling once a second for ten minutes is that loop, whichever modules
  it calls.
- **The MCP Registry lists one server**, `com.strategydance/strategydance`, when David takes the
  listing up.

Left for later:
- **Retiring the per-module addresses**, M4, which Retiring them describes, with what the
  transition keeps beside them.
- **Knowledge and Subagents for external agents**, each a plan of its own, as knowledge.md and
  conversations.md § Subagents say.

## How it works

Before M1, each module builds a server of its own. Each section names the milestone that builds it,
and a name it gives is new until then.

### One server, any modules (M1)

- **Each module registers on a server it is given.** `create<Name>Server(access)` becomes
  `register<Name>Module(server, access)`, which registers the module's tools in their frozen order:
  - through its own `createModuleToolRegistrar`, for its own web addresses: Documents, Tasks and
    Budget;
  - through `server.registerTool`: Subagents and Knowledge, as today.

  Its instructions split into what is its own and what every module shares (see Instructions).
- **`createModulesServer(access, modules)`** builds one `McpServer` and registers, in `MODULES`'
  order, each module given whose read scope the access holds. Given one module, the server keeps
  that module's name and title; given several, it is `strategydance`, titled "Strategy Dance".
  `MODULE_SERVERS` gives way to it.
- **Its caller names the modules**, never the access's kind:
  - Strategy Dance's worker, `CONVERSATION_MODULES`, every scope of which its access holds, so all
    five;
  - each per-module endpoint, its module, so an external agent there gets what it gets today;
  - from M2, the one address, its address's `modules`, so a connection there gets the modules it was
    granted;
  - `serveModule.ts`, the module it names, Knowledge included, and `bun run mcp <email>` the served
    modules.
- **`createModuleHandler(modules)`** builds that server for each request from the access, as today.
  Building every module given rather than the one a call names costs nothing worth saving: on
  2026-11-08, the five modules' servers took 0.03 ms for Strategy Dance's agent, and the three served
  modules' 0.08 ms for an external agent reaching two organizations.
- **Strategy Dance's agent connects one client**, through one handler given `CONVERSATION_MODULES`,
  rather than five.
  - `tools/list` answers the tools module by module in `MODULES`' order, which is
    `CONVERSATION_MODULES`' order, so the converted list is the same bytes.
    `buildConversationTools.test.ts` pins its names and hash, and the milestone changes neither.
  - `buildSubagentTools` filters by name, as it does.
  - `measureConversationMessage` and `measureSubagentLaunch` connect through the same function.
- **`moduleServers.test.ts`** lists each module's tools through the server built with that module
  alone, and every name across `CONVERSATION_MODULES` through one server.
- **`bun run mcp <email>`** serves every served module on one server over stdio against the
  emulators, with their scopes, as `mcp:documents` serves one module.
- **The backend's `CLAUDE.md`**: § Modules builds a module with `register<Name>Module(server,
  access)` on `createModulesServer`, where it names `create<Name>Server(access)`, and Scripts lists
  `bun run mcp <email>`.

### Instructions (M1)

Strategy Dance's agent reads no server instructions: only an external agent's client does. A server
given several modules says, in order:
1. what Strategy Dance is, once;
2. each listed module's own paragraphs, in `MODULES`' order, worded as one server's: "the Documents
   module's read_document" becomes `read_document`, and a module that is not listed is never named
   in them;
3. the idempotency key, once;
4. the organizations the connection reaches, once, as `toModuleInstructions` writes them;
5. for an external agent, the modules it was given but does not list, which its connection is not
   allowed in, by name and never by their tools, without saying why, since the member may have left
   one out or it may be served since the connection was made. The agent can then tell the member,
   who chooses what a connection may do in each module when they connect it again. Added in the
   review of 2026-11-10: before, an agent asked to add a bill with Budget left out could not know
   Budget was there at all.

The key and the organizations are said where a served module is listed, whose tools take both:
Knowledge's and Subagents' servers never said them. A module listed alone on a server given several
is worded as beside none, and its server keeps the name `strategydance`. A server given one module
says what it says today.

### Addresses (M2)

Core gains `MODULE_ADDRESSES` beside `MODULES`, what the public backend serves, each `{ name, path,
title, modules }`:
- the one address first, `{ name: 'strategydance', path: '/mcp', title: 'Strategy Dance', modules:
  SERVED_MODULE_NAMES }`;
- then each served module's own, derived from `SERVED_MODULES`, its name, path and title, and itself
  alone as `modules`, so a module's path and title stay written in `MODULES` alone.

An address's scopes are its modules' read and write scopes, and `ModuleAddressName` names one. The
routes, the protected resource metadata, `OAUTH_PROTOCOL_PATHS`, every reader of
`parseModuleResource`, the consent page, the sweep and Connected agents read the addresses here.
`OAUTH_PROTOCOL_PATHS` lists the paths that answer any origin, each served module's metadata among
them, so a client in a browser reads `/mcp`'s metadata as it reads a module's. The metadata routers
mount the longest path first: the SDK mounts each with a prefix match, so `/mcp`'s would otherwise
answer every module's first. All of it lands in
the milestone that serves the one address, so nothing answers at `/mcp` before its scopes, its
refresh and its sweep are in place. A per-module address is the case of one module, so it behaves
as today. The backend's `CLAUDE.md` § Modules names the one address and `MODULE_ADDRESSES` in the
same milestone.

### The OAuth resource (M2)

- **The endpoint** is `POST /mcp`, mounted before the per-module ones, behind the same checks in the
  same order, its verifier and `expectedResource` the one address, `https://api.strategydance.com/mcp`.
  - Its protected resource metadata is at `/.well-known/oauth-protected-resource/mcp`, with every
    served module's scopes and "Strategy Dance" as its name.
  - The authorization server's metadata lists every served scope already.
- **`parseModuleResource`** resolves any address of `MODULE_ADDRESSES`, the one address included,
  and answers it. Each of its readers takes the address and its modules rather than one module:
  starting an authorization, loading the consent's request, exchanging a code, refreshing, and the
  verifier.
- **`parseModuleScopes(modules, scope)`**, given the address's modules, under one rule,
  `checkModuleScopes`, which a refresh and Allow hold to too:
  - for each of the address's modules: its read scope, alone or with its write scope, or neither;
  - at least one module's read scope;
  - never a write without its read, nor a scope of a module the address does not serve;
  - no scope at all asks for every module's read and write.

  A per-module address has one module, so this is today's rule.
- **A refresh** names its token's scopes or fewer, as today, under the same rule: at least one
  module's read, and never a write without its read. A refresh and the verifier keep to the scopes
  of the modules the address serves, so a module it stops serving drops out of a connection rather
  than refuse its refreshes or appear in its challenges. `checkModuleScopes` holds a refresh to the
  rule, as it does an authorization and Allow.
- **The scope challenge names the scopes the connection holds with those the call needs**, rather
  than the write scope alone, which the SDK's `requireScopes` names. A client that asks again for
  exactly the challenge's scopes then keeps every module it held, and names each write with its
  read, which `parseModuleScopes` asks for. `requireModuleWriteScope` writes it as a
  `ScopeChallengeHandler` of its own, through `toModuleScopeChallenge`, which the challenge of a tool
  of a module not held shares.
  - A challenge reads only the call's `authInfo`, whose scopes are the token's, which a refresh may
    have narrowed below its connection's. So the verifier carries the connection's scopes in the
    access too, `connectionScopes` beside `scopes`, and the challenge names those. `ModuleAccess`'s
    external kind and `readModuleAccess`'s schema gain the field: that schema is strict, refusing a
    field it does not know, so the verifier writing it alone would fail every external call.
- **A tool of a module not held is challenged.** The server lists only the modules held, and the
  SDK answers a call to a tool it does not list with a protocol error, `Tool … not found`, and
  challenges only the tools it lists, which the backend's rule of refusing through
  `toToolRefusal` forbids. So the endpoint reads a `tools/call`'s tool name before the server is
  built, once the body is parsed, and for a tool of a module the address serves whose read the
  access lacks, answers 403 `insufficient_scope` naming the connection's scopes with that module's
  read, as the write's challenge does. `findToolModule` knows each tool's module by registering
  every served module once on a stand-in that records the names. A stateless server sends no `list_changed`, so this is how a client learns a
  module is gone, or asks for one.
- **The consent page** lists each module the request asks for, and each the connection it replaces
  holds, with its access: not allowed, read, or read and write when write was asked for or is held.
  - It is worded by the module from the `module` catalogue, as `OAuthConsentAccess` words one now.
  - To begin with, a first consent chooses each module as asked, read and write when asked, read
    when not. Consenting again chooses each module as the connection it replaces holds it, its write
    kept when held even if not asked for, and a module not held not allowed, what was asked beyond
    it offered (Decisions, since the review of 2026-11-10). Budget's write starts chosen only when
    the request asks for it and the connection held it. Wherever a module starts below what the
    agent asked for, that option is marked "Asked for". Every module the page grants is shown with
    its access, held ones included, so nothing is granted out of the member's sight.
  - The organizations are ticked once for every module, as today.
  - Allow stays off while no module is allowed. "Not allowed" is offered only beside another module,
    and a module's own address shows its one module as it always has.
  - A module's own address keeps what its connection held the same way, its write included, since it
    goes through the same rule, but starts a module as held, or as asked when that is more: Access
    narrows nothing there, and its write challenge is how a member there grants a write.
- **Allow** takes the scopes chosen, checked against the rule above, each asked for or held by the
  connection it replaces: a consent never grants what neither the agent asked for nor the member
  granted before.
  - Consenting again with the same client at the same address replaces the connection, as today.
    Allow deletes it with its tokens and inserts another, in one mutation under the member's lock,
    since `AgentConnection` is unique on its account, its client and its address's name.
  - So a code presented again, a refresh token rotated or a revocation that read its credential
    before a consent acts on nothing after it: the connection it would join or revoke is gone, and
    its tokens with it. An update in place would keep the id reachable from every earlier
    credential, so the id changes with each consent, and the idempotency scope does not depend on
    it (below).
  - `ApproveOAuthAuthorizationRequest` holds the scopes granted to the request's today
    (`includesAll`). The backend now splits the scopes chosen into those the request asked for and
    those only the connection held, and the mutation checks the first against the request and the
    second against the connection, before it deletes the connection. `GetAgentConnectionForConsent`
    answers the connection's scopes for the page. Allow reads nothing to check what it keeps: the
    mutation's check after the lock is the one that counts.
  - The check against the connection reads it in a step that reads the member lock's `response`, as
    the database's `CLAUDE.md` asks of a step after a lock, so it sees a narrowing that committed
    while Allow waited on the lock, never the statement's older snapshot.
  - The request's check stays on `$scopes`, required as it is, so the backend before M2, which sends
    nothing else, is refused a scope its request did not ask for as today. The held scopes join as
    an optional variable, `$heldScopes`, and leaving it out grants nothing beyond `$scopes`: never an
    optional list in a filter, which the database's `CLAUDE.md` says is dropped when left out,
    matching every row. Its check is a CEL `all` over the replaced connection's `scopes`.
  - The connection is inserted with `$scopes`, and `$heldScopes` appended in a step of its own that
    reads the insert's response (`scopes_update: [{ append: … }]`): the emulator showed a step in the
    same statement never sees the insert, and an append of an absent or empty list changes nothing.
    A code's exchange then names the scopes in `MODULES`' order, whatever order they were stored in.
  - The approve route's body takes up to two scopes for each served module, where it takes two.
- **Through the release.** A release deploys Data Connect, then the backend, then the web, so for a
  few minutes each serves the one before it:
  - the variables `ApproveOAuthAuthorizationRequest` gains join optional, as the database's
    `CLAUDE.md` asks, so the backend before M2 still calls it, and `GetAgentConnectionForConsent`
    only answers more;
  - the request's summary keeps `module` and `scopes` for a per-module address beside what it adds,
    and the approve body stays `{ organizationIds, scopes }`, so a consent page loaded before the
    release still allows a per-module request. A later release drops `module`, as #306 dropped the
    approve route's single `organizationId`.

  A page loaded before the release draws nothing for a request at `/mcp`, but no client is told of
  that address before M3.
- **The idempotency scope outlives a consent at the one address.** There the verifier builds an
  external agent's scope from the member's account, the client's id and the address's name, rather
  than `connection:<id>`, which every consent changes.
  - It is `external:` and `hashOAuthToken(JSON.stringify([userId, clientId, addressName]))`, the
    SHA-256 in base64url the tokens are kept under. The JSON array keeps two triples from writing
    the same text, since a client's id is a free-form address.
  - `external:` says what the codebase calls such a caller, `kind: 'external'`, where `agent`
    names Strategy Dance's own.
  - The per-module addresses keep `connection:<id>`, and the gap a consent opens there today, until
    they retire. Moving them too would change the scope of a write sent to the backend before the
    release and retried after it, which would then be applied twice.
  - The rate limit, keyed on the scope, outlives a consent with it.
  - A document revision an external agent's edit keeps carries the new scope. The web reads it as an
    external agent's, as `readDocumentRevisionSource` reads any scope that is not a conversation's.
  - conversations.md names `connection:<id>` as an external agent's scope in § Modules and § Rich
    text and Markdown: both add the one address's `external:` in M2.
- **The daily sweep keeps the one address's connections.** `pruneUnservedAgentConnections` passes
  the served modules' names today, so it would delete a connection to the one address once neither
  made nor used for a week. From M2 it takes the served addresses' names, `strategydance` and each
  per-module address's.
- **Tokens** are bound to the one address as their resource, under the same verifier. A token issued
  for `/mcp/tasks` never opens `/mcp`, nor one for `/mcp` a module's address. At every call the
  verifier narrows a token's scopes to its connection's, as it does now.
- **`check:oauth`** walks the whole flow against `http://localhost:3003/mcp` too:
  - a consent to two modules;
  - a module left out, absent from `tools/list`, and a call to one of its tools challenged for its
    read;
  - a read-only module's write, challenged with the connection's scopes and the write;
  - a refresh narrowing to one module, then reuse and revocation.

### Connections at the one address (M2)

Once `/mcp` answers, a member may connect there before the module pages say so, and each milestone
may ship alone, so the app reads such a connection from M2:
- **A connection's row** on Connected agents names its address: for the one address, "Strategy
  Dance", with each module's access, as "Documents: read and write. Tasks: read."; for a per-module
  address, the module, as now. `AgentConnectionRow` writes a module it does not know by its raw name
  today.
- **Delegate** on a task copies its prompt for a connection to the one address holding `tasks:read`
  in the task's organization, as for one to `/mcp/tasks`. `TaskDelegation` counts a connection
  whose module is `tasks` alone today.
- **The Delegate prompt**, `task.delegatePrompt`, names the task board's tools, `read_task` and
  `update_task`, rather than "the Strategy Dance Tasks MCP server", the per-module server's title,
  so an agent connected at either address finds them. Its description, which asks to keep that name, follows, and `bun run translate`
  runs.

### Access and the module pages (M3)

- **A per-module row** is marked as an older address, for its module alone, with a link that opens
  the steps to connect at the one address: the agents dialog, without its closing link back to
  Connected agents.
- **Access** is a button beside Organizations on a row of the one address, while the connection
  holds something to narrow, more than one module or a write. It opens a dialog that narrows what
  the connection may do in each module, through `UpdateAgentConnectionScopes`, from its next call,
  since the verifier reads the connection's scopes.
  - It never widens them, since only a consent grants, through the agent's own request: a member who
    wants more consents again through the agent. So the dialog lists only the modules the
    connection holds, each through the consent page's chooser, `OAuthConsentAccess`, offering read
    and write only where it is held, and not allowed beside another module.
  - At least one module stays read, and no write stays without its read. Save stays off until
    something changes, and while no module is allowed, as Allow does on the consent page. The
    member's choices are kept apart from what the connection holds, each capped at it, so a
    narrowing saved meanwhile in another tab, which the live list brings in, lowers a choice rather
    than leave one the mutation would refuse.
  - The mutation checks the rule on its variables before anything else: a read among them
    (`endsWith(':read')`), each write's read, module by module over `MODULES`' names, which
    `schema.test.ts` holds the list to, since CEL as Data Connect documents it cannot take a
    scope's module from it, and each scope once. Then every scope named is one the connection
    holds, read after the lock.
  - It locks the member's row first, as `UpdateAgentConnectionOrganizations` does, and reads the
    connection in a step that reads the lock's `response`, so it runs before or after an Allow,
    never across one.
  - Unlike that mutation, it leaves `grantedAt` as it is. Narrowing grants nothing, and a newer
    `grantedAt` would bring back an organization the member left and rejoined since, which
    `readAgentConnectionReach` leaves out.
- **A refresh follows a narrowing.** The access and refresh tokens a refresh issues hold the refresh
  token's scopes within its connection's, and its answer names those, so a client is never told of
  a write the member took away. `refreshAgentConnectionTokens` filters the refresh token's scopes by
  the connection's, which `GetAgentConnectionRefreshToken` read already.
  - A refresh naming more than its token and its connection hold gets what is left, which its answer
    names (RFC 6749, 3.3), at every refresh: many clients repeat the scope they first asked for, so
    a refusal would send the member through a consent again once they chose less, on the consent
    page or here. Only a refresh naming a scope its address does not serve, a write without its
    read, or nothing its token still reads is refused `invalid_scope`. A first draft was lenient
    only with the scopes the connection lost, which held for one refresh, since the rotated refresh
    token keeps the narrowed scopes: #317's review found it.
  - A duplicate, a refresh token presented again within 30 seconds, is answered with the pair its
    rotation issued, which may predate the narrowing. `answerDuplicate` compares and names that
    pair's scopes within the connection's too, so it neither announces a removed write nor refuses a
    client for one: the verifier narrows the pair's access token at every call already. A pair the
    narrowing left reading no module, which would open nothing, is refused `invalid_grant`.
  - A narrowing committing between a refresh's read and its rotation shows from the next call, the
    verifier narrowing the access token then, and from the next refresh.
  - An access token a narrowing left reading no module its connection holds, as one a refresh
    narrowed to Tasks is once the member keeps Documents alone, is refused by the verifier as
    `invalid_token`, so its client refreshes into what is left rather than consent again, as a
    challenge would have it.
- **"Use with your agents"**, on Documents, Tasks and Budget, gives the one address, with the same
  instructions for each client, and says that one connection reaches every module the member
  allows. `readAgentsSetup` writes the address, the Claude Code line and Cursor's configuration,
  under the server name `strategydance`, in place of `getModuleAddress`.
- **The root's `CLAUDE.md`**: Tackling a task names the `strategydance` server and its `claude mcp
  add` line.
- **conversations.md § Modules** describes the one address in place of One server per module, and
  External agents follows it.

### Retiring them (later)

When David chooses, a release takes the per-module addresses out of `MODULE_ADDRESSES`:
- Their endpoints and metadata answer 404, and their tokens are refused at the next call, as for an
  address no module has.
- Their names leave the served addresses' names that `pruneUnservedAgentConnections` takes from M2,
  so their rows go a week after their last use, as a retired module's do, while `strategydance`
  stays.
- The paths stay reserved, never reused, so no token issued for one can ever open anything else, as
  knowledge.md asks of `/mcp/knowledge`.

## What changes for each caller

**Strategy Dance's agent** sees nothing change: the same tools in the same order, the same bytes, and
the same fence, idempotency, recovery and caps. A run connects once in process, rather than five
times.

**External agents** get:
- one address to add, one consent, one row on Connected agents and one introduction in the client's
  context;
- the tools of the modules the member allowed, 23 for all three today;
- one token, whose scopes bound what it does in each module. A client connected to all three holds
  as much today, and a leaked token holds every module allowed, which Access narrows;
- one rate limit across the modules, where today each module's connection has its own;
- one set of organizations for every module, where a connection per module could reach different
  ones;
- the member's search allowance, the AI permissions, the `organization` parameter and the
  idempotency key, as they are.

## Risks

- **Clients and scopes.** A client may ask for every scope of `scopes_supported` whatever the member
  wants, which the consent reduces, or may not ask again after a challenge. M2 checks Claude Code
  with `claude -p` and the flow with `check:oauth`. claude.ai, ChatGPT and Cursor are checked by hand
  once the address is served.
- **Two addresses at once.** Through the transition, a member may connect one agent at both, and see
  two rows. Connected agents marks the older one from M3, when the module pages start giving the one
  address. Before M3, no member is told of it, so two rows come only from someone who found it.
- **A module left out stays out of sight.** A connection lists only the modules it holds, so its
  agent cannot call one the member left out, and a member who wants it consents again, where today
  they add the module's address. Its instructions name the modules left out, so the agent can tell
  the member.
- **One set of organizations.** Every module of a connection reaches the same organizations, so a
  member who wants Budget in fewer of them than Documents connects a second client. Few members
  belong to several organizations yet: per-module organizations wait until one asks.

## Milestones

| # | Milestone | Packages | Depends on | Implementation PR |
| --- | --- | --- | --- | --- |
| M1 | One server, any modules | backend | | [#315](https://github.com/dherault/strategydance/pull/315) |
| M2 | One OAuth resource at `/mcp` | core, database, backend, web | M1 | [#316](https://github.com/dherault/strategydance/pull/316) |
| M3 | Access and the module pages | database, backend, web, root | M2 | [#317](https://github.com/dherault/strategydance/pull/317) |
| M4 | Retire the per-module addresses | core, database, backend, web, root | M3, its trigger | |

M1 to M3 merged into `dev` on 2026-11-10. What the release owes by hand is in After the release.

### Conventions for every milestone

- **Follow `CLAUDE.md`:**
  - a branch from `origin/dev`;
  - granular commits, each green on lint, typecheck, test and build;
  - their code review, then a pull request into `dev`;
  - then a human merges.
- **Read this document first**, and conversations.md § Modules for what every module keeps.
- **The tools Strategy Dance's agent sends never change.** `buildConversationTools.test.ts` stays as
  it is, and `bun run probe:claude` runs once M1 lands, as for any change to the modules.
- **No migration.** Operations change, not columns: M2 changes `ApproveOAuthAuthorizationRequest`
  and `GetAgentConnectionForConsent`, M3 adds `UpdateAgentConnectionScopes`, and the schema's
  comments follow.
- **The rules follow the code.** A milestone updates in its own pull request each `CLAUDE.md` rule
  and document passage that describes what it changes, the ones How it works names and any it finds
  besides, so none describes code that is gone.
- **Each release serves the one before it.** Data Connect deploys first, then the backend, then the
  web: a variable joins an operation optional, an answer only grows, and what the web reads and
  posts keeps working for a page loaded before the release (Through the release).
- **Messages.** `bun run translate` runs whenever a message changes, in the same commit, and no
  message holds an em dash.
- **Every milestone ends with the four checks green.** Its **To verify** list is what its session runs
  before handing the pull request over, and the pull request says how each went.

### M1: One server, any modules

One server, any modules, and Instructions above. Nothing an external agent reaches changes: each
per-module endpoint serves its module through the server given that module alone, and nothing
answers at `/mcp`.

**Tests:**
- `createModulesServer`:
  - Strategy Dance's agent's access, given `CONVERSATION_MODULES`, lists every module's tools, in
    `MODULES`' order;
  - an external access given the served modules lists those it holds the read scope of, and none
    other;
  - given one module, it lists that module alone, with the name, title and instructions it has
    today.
- A server given several modules names in its instructions each module listed and none other, and
  the organizations once.
- `connectConversationModules` connects one client, its runners reaching every module.

**To verify, once implemented:**
- `buildConversationTools.test.ts` unchanged, and green.
- `bun run probe:claude`.
- Over stdio, from Claude Code (`claude -p` with a scratch `--mcp-config` running `bun run mcp
  <email>` against the emulators), one session that reads a document and moves a task.
- `bun scripts/serveModule.ts knowledge <email>` still lists Knowledge's tools.
- The four checks.

### M2: One OAuth resource at `/mcp`

Addresses, The OAuth resource and Connections at the one address above: the addresses, the
endpoint, its metadata, resource and scope parsing, the refresh, the challenge, the consent page,
Allow, the idempotency scope, the sweep, what the release keeps for the pages before it, and the
rows, Delegate and its prompt that read a connection there.

**Tests:**
- `parseModuleScopes` for the one address: two modules read, one read and write, write without read
  refused, a scope of no served module refused, no scope at all.
- `parseModuleResource` resolving `/mcp` and every per-module address, and refusing a trailing slash.
- A refresh at the one address narrowing to one module, and refused when it names no read, or a
  write without its read.
- The verifier refusing a token for `/mcp/tasks` at `/mcp`, and the reverse.
- The challenge naming the connection's scopes with the write, for a token a refresh narrowed below
  them too.
- A call to a tool of a served module the connection does not hold, challenged for that module's
  read, and one to a name no module has, answered as the SDK does.
- The approve route taking every served module's two scopes, and a per-module request's summary and
  body as they are today.
- The consent page: a module left unallowed, Allow off with none allowed, a connection replaced
  keeping its choices as defaults, a request for one module listing the others it holds, and
  Budget starting at read when its write is asked for but was not held, or held but not asked for.
- Allow: consenting again replaces the connection with its tokens, leaving an earlier code and an
  earlier refresh token opening nothing; a scope neither asked for nor held refused; and a call
  without the new variables, as the backend before M2 sends it, refused a scope its request did not
  ask for.
- An external access carrying `connectionScopes` read back by `readModuleAccess`.
- The idempotency scope at the one address: `external:` and the hash, the same before and after a
  consent of one client, different for another client or another member, and a write retried under
  its key after a consent that kept its write answered from its stored result. At a per-module
  address, `connection:<id>` as today.
- The sweep keeping an idle connection to the one address, and deleting one to a module served at
  no address.
- A row of the one address listing each module's access.
- Delegate copying its prompt for a connection to the one address holding `tasks:read` in the
  task's organization, and not for one without it.

**To verify, once implemented:**
- `bun run check:oauth` against `http://localhost:3003/mcp`, as How it works lists.
- Over HTTP, from Claude Code (`claude -p` with a scratch `--mcp-config` whose headers carry a bearer
  token from a script running the flow), two organizations and two modules on one connection.
- Delegate's prompt, pasted into Claude Code connected at `/mcp` alone, finds the task and moves it.
- The four checks.

### M3: Access and the module pages

Access and the module pages above, and the documents that follow.

**Tests:**
- `UpdateAgentConnectionScopes` narrowing a module, refusing a widening, refusing to leave no module
  read or a write without its read, and leaving `grantedAt` as it was.
- A refresh after a narrowing issuing and naming the narrowed scopes alone, and a duplicate of a
  rotation from before the narrowing answered with the narrowed scopes named.
- A per-module row marked as older: the web has no component tests, so the row follows
  `readAgentConnectionAccess`'s `kind: 'module'`, which its tests pin, and the app shows it.
- The agents dialog giving `/mcp` on each module's page, through `readAgentsSetup`'s test.

**To verify, once implemented:**
- In the app against the local backend: connect Claude Code at `/mcp`, narrow Tasks to read on
  Connected agents, and see a task write challenged at the next call.
- The four checks.

### M4: Retire the per-module addresses

Retiring them above, once its trigger holds: the release after the one that ships `/mcp`, once a
read-only count of production's connections at a per-module address used in the last 14 days is
zero, or once David has told the members who hold one. The transition keeps, and M4 removes:
- each served module's own entry in `MODULE_ADDRESSES`, its endpoint and its metadata, which then
  answer 404, their paths staying reserved;
- `connection:<id>` as an idempotency scope, every external agent's being `external:`;
- the request summary's `module`, which pages from before M2 read;
- the per-module row's marking as older and its link, and `/mcp/budget`'s consent of its own;
- `strategydance-tasks` and `strategydance-documents` in the root `CLAUDE.md`'s Tackling a task.

`AgentConnection.module` holds an address's name since M2. Renaming it `address` is a migration,
whose release stops at Data Connect for a human (`CLAUDE.md` § Releases and production): M4 takes
it only if David wants the name to say what it holds.

**To verify:** `check:oauth` with the per-module checks gone, a per-module address answering 404,
and the sweep deleting a per-module connection a week after its last use.

### After the release

What the release that ships M1 to M3 owes by hand, once `main` deploys:
- `bun run probe:claude`, owed since M1 (#315), with the Anthropic key read through gcloud as
  #315 says, since a run now connects its modules through one client.
- Re-adding Claude Code's server, `claude mcp add --transport http strategydance
  https://api.strategydance.com/mcp`, then `/mcp`, allowing Tasks and Documents: the root
  `CLAUDE.md` names it from #317, and production answers 404 there until the release.
- claude.ai, ChatGPT and Cursor connected at `/mcp` by hand, as Risks asks: the consent, the tools
  of the modules allowed, a write challenged and allowed again.

## Review of 2026-11-10

An adversarial review of #315, #316 and #317, once merged, found no correctness or security defect:
one scope rule at an authorization, Allow, a refresh and the verifier, Allow's held scopes checked
after the member's lock, Access only narrowing under the same lock, the verifier narrowing a token
to its connection at every call, and no operation or column removed, so the release does not stop
at Data Connect. It changed:
- the consent's defaults, so consenting again starts as the connection holds and grants nothing
  more unless the member chooses it (Decisions). A first version kept a write held at read at read
  alone, and its review found a module left out still starting chosen. A second review found the
  page never said what the agent had asked for, so an Allow left as it started granted nothing and
  the agent asked again: the asked option is now marked;
- the instructions, which name the modules a connection is not allowed in, by the connection's
  scopes rather than the token's (Instructions);
- `check:oauth`, which walks an Allow granting nothing asked for, only what was held, its code
  issuing nothing asked for that was not granted;
- this document, which says what one set of organizations costs, writes M4 and lists what the
  release owes.

It kept, having weighed them again:
- a connection per client, so a client that registers again, under a new id, makes a connection of
  its own, its consent a first one: no client identity outlives a registration;
- what a connection holds as the record of the member's choices, rather than a column of the scopes
  they declined: starting as held protects every narrowing, at the cost of a click on each widening,
  and a record of intent waits until that click proves costly;
- a refresh naming more than its token holds getting what is left, rather than `invalid_scope`
  (RFC 6749, 6), which never widens and spares the member a consent;
- one rate limit across the modules;
- `findToolModule`'s stand-in, which `moduleServers.test.ts` pins;
- a batch answered 403 whole, batches having left MCP in 2025-06-18;
- a token a refresh narrowed below its connection challenged into a consent rather than a refresh,
  which few clients ever make.
