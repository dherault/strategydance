# strategydance-design-system

The component library's conventions, beside the root `CLAUDE.md`. Other packages import
`strategydance-design-system/components/ui/Button` or `strategydance-design-system/index.css`, and
the package imports itself by that name, mapped to `src/`.

## Components

- `components/*` exports `.tsx` files alone: a `.ts` or `.css` beside a component breaks the web's
  build, so helpers go in `lib/`. The backend imports `lib/` alone, never a component
- Build on shadcn's component, Base UI's where shadcn uses it, and every component takes a story.
  A design from Claude Design keeps its props and wording, ported onto the shadcn component rather
  than its own markup
- A Base UI popup inside a Radix dialog portals into the dialog and claims Escape while open, with a
  story inside a `Dialog`, since Radix traps focus and pointer events and closes on any Escape
- Oswald's descenders hang below its tight leading, so a box that clips cuts them. Their room lives
  in `index.css`'s `--descender-room` and the `descender-room` utility: widen a gap there, never
  with a padding on one element
- recharts reads elements through `react-is`, so the two keep one version, bumped together, and the
  web declares both at the same ranges

## Rich text

- The editor is BlockNote's, in its shadcn flavour, and `RichText` draws what it writes without it.
  A post, a task's description and a knowledge document each have their list of blocks
  (`RICH_TEXT_POST_BLOCKS`, `RICH_TEXT_TASK_BLOCKS`, `RICH_TEXT_EDITOR_BLOCKS`)
- Custom blocks and mentions are BlockNote core's specs on plain DOM, never React, so the headless
  editor of the Yjs helpers loads no React. `RichTextEditor.css` dresses BlockNote's menus in the
  tokens
- A tab on an older bundle deletes from the shared text any block, inline type or style its schema
  lacks, so a new one reaches every tab before anybody can write it, unless David chooses otherwise.
  A node's props are append-only, and a document's editor and its Yjs helpers keep one list
- Outside an editor, text is written as a difference through `updateRichTextYDoc`, never rebuilt
  from blocks, which merges as a second copy
- The agent's replies are drawn through `Markdown`, never `react-markdown`. It draws HTML as text,
  links to web, mail, `doc:` and `task:` addresses alone, never loads an image, and draws a text
  past `MARKDOWN_HAZARD_LIMITS` as plain text: a shape found slow joins `countMarkdownHazards`,
  measured the same way
- `markdownToRichText`, like the backend's `splitConversationText`, parses with markdown-it, never
  micromark, which takes minutes on lists or brackets by the thousand

## The design sync

The Claude Design project follows the components through the `/design-sync` skill, which a person
starts ([design-sync.md](../../documents/design-sync.md), `.design-sync/NOTES.md`). A component's
props and usage note are written by hand, in `.design-sync/config.json`'s `dtsPropsFor` and
`.design-sync/docs/<Name>.md`: a change to its props or behaviour changes them too, which `bun
.design-sync/checkNames.ts` and `bun .design-sync/runExamples.ts` check only in part.
