import type { ConversationTextBlock } from '~types'

type NamedFile = {
  // Canonical, as `toCanonicalUuid` writes it
  id: string
  name: string
}

/*
  The text block a member's entry names its files in, before them, one line per file in their order:
  its name and its id, as `report.pdf (attachment <id>)`. Claude sees an image untitled and a document
  by its title alone, so without it the agent could name no file to hand a subagent, which takes a
  file by that id. A name is one line, refused at its upload otherwise. Only entries sent from M33 on
  hold it, so the history keeps the bytes it was sent as
*/
function buildConversationFileNames(files: readonly NamedFile[]): ConversationTextBlock {
  return { type: 'text', text: files.map(({ id, name }) => `${name} (attachment ${id})`).join('\n') }
}

export default buildConversationFileNames
