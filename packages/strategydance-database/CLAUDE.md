# The database

The Data Connect service's conventions, beside the root `CLAUDE.md`: the schema in
`schema/schema.gql`, and one connector per caller, `strategydance-web-connector` for the browser and
`strategydance-backend-connector` for the backend, generated as an Admin SDK with every operation
`NO_ACCESS`. The generated SDK is the only way anything talks to the database.

## Operations

- Every operation carries an `@auth` level, and `USER` keys off `auth.uid`. The backend passes the
  `uid` it verified as a variable, never one a client sent, and each operation checks it against the
  rows it touches. The one `PUBLIC` operation is the sign-in screen's email lookup, and the OAuth
  operations that find a row by a random value or its hash are the only others to read before any
  `$userId` is checked
- An operation finding its row by `auth.token.email` is `USER_EMAIL_VERIFIED`, since a password
  sign-up can name any unclaimed address
- The server's values win over variables: `id_expr: "auth.uid"`, `email_expr: "auth.token.email"`,
  `updatedAt_expr: "request.time"`
- A table references the account and the organization apart, so removing a member, which deletes
  the membership, keeps what they wrote. What belongs to the membership, its connections and their
  tokens, goes with it. A reference to `UserOrganization` names its `userId` and `organizationId`
  columns with `@ref`, its constraint's name within Postgres' 63 bytes
- A variable joins an operation optional, so an older page can leave it out, and its `@check` reads
  `!has(vars.x) || vars.x == null || …`, since `vars.x == null` alone errors on an absent variable
- `Locale`, `Currency` and `KnowledgeKind` are declared in both `schema.gql` and core, which
  `schema.test.ts` holds together, as it holds the Budget's limits to their checks. Every other enum
  lives here alone. An enum's order is Postgres': append a value, never reorder one
- A schema change reaches production with its release, Data Connect first, and a migration that
  drops anything stops the release for a human

## Live queries

A list a page keeps current is a live query: `@refresh(onMutationExecuted: …)` names each mutation
that changes it, with a condition on a variable they share, so a new mutation changing its rows
joins its refreshes, and one writing a column only a background job touches, like `lastUsedAt`,
never does. The backend's mutations fire them too but carry no `mutation.auth.uid`, so a web
conversation mutation takes the caller's `$userId`, checked against `auth.uid`, and the refreshes
match `mutation.variables.userId == request.auth.uid`. An id handed to an operation is canonical
(`toCanonicalUuid`), since a refresh condition compares variables as text, and a hyphenated id
refreshes no other tab.

## Data Connect, found the hard way

- The SDKs cannot pass a list of `_Data`, so nothing batch inserts: the backend calls a single-row
  mutation once per row
- A level of a `where` holds plain fields or `_and`, `_or` and `_not`, never both
- An operation takes no `@check` of its own: a check on variables alone sits on a field of the first,
  redacted step
- A mutation runs as one SQL statement, reading one snapshot, unless a step reads an earlier step's
  `response`, when each step runs apart. So a step counting or filtering rows after a lock another
  writer takes reads that lock's response, or it misses what the holder committed. One statement
  also misses its own earlier writes: count around them by their ids
- A mutation writes each row once: a later write to a row in one statement is skipped silently. When
  the row a mutation locks is the row it writes, the write is the lock, and the checks follow it
- A mutation takes one `query` step: a check that has to follow a write goes there, and its refusal
  rolls back the writes before it
- A `@check` under a list that comes back empty is never invoked, yet Data Connect refuses with its
  message rather than the list's: a variable's check nested under a write's membership takes
  `optional: true`, so a removed member gets the membership's message
- `@include(if: $flag)` skips a step, but its variables stay required and a key it names is refused
  null: a step whose key may be missing is an operation of its own
- A foreign key violated by a later step is reported before an earlier step's `@check`, so the
  backend reads both messages as one refusal (`isMembershipRefusal`)
- A filter on an optional list left out is dropped and matches every row: count the rows against
  the list (`this == size(vars.ids)`). A nullable variable left out of a write leaves its column
  alone: only null clears it
- A request takes 4 MiB at most. The generator declares an enum only when an operation selects a
  field of that type at its top level
- An emulator runs one operation at a time, so no race shows through one: the backend's
  `check:conversation-races` runs four on one Postgres

## Rows with rules

- A document's text is a Yjs document: `Document.state` holds the snapshot, `DocumentUpdate` rows
  the edits since, and `content` a copy. Once a document has a snapshot, its text is written through
  Yjs alone, as a difference (the design system's `updateRichTextYDoc`)
- Every write of a document's `content` writes its plain text, `contentText`, and every write of a
  task's description `descriptionText`, which the modules search: a new write does the same or
  nulls it. An agent's edit keeps the text it replaced as a `DocumentRevision` in the same mutation
- A mutation cut off midway can wedge the emulator until it restarts, so a document's page sends
  only writes that are no transaction as it goes away
- The board's tasks change one field per mutation. A move names the column it saw the task in
  (`$fromStatus`), and a move into Done goes through `FinishTask`, which stamps `doneAt`. A
  `TaskDependency` never makes a task wait on itself or on one waiting on it, and the page offers no
  pick that would close a longer loop
- A conversation's transcript is the backend's alone, and its thread is ordered by `position`,
  never time. A message's field that changes in place belongs in `GetConversation`'s live tail, one
  that never changes in the bodies (`GetConversationMessageBodies`)
- An organization's MCP servers and members' connections to them are the backend's to write, and
  no web operation selects a key, a token, a code or a verifier
- An organization's `slug` is drawn at its creation and never changes, so a link outlives a rename.
  One from before slugs has none, and its id stands in
