import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

/*
  The words of each task's description, in lowercase, by its id, for the board's search. Read once
  per change of the descriptions rather than per keystroke: parsing every serialized description
  is the slow part, and the board's compiled render keeps this until the descriptions move
*/
function getTaskDescriptionTexts(descriptions: ReadonlyMap<string, string>) {
  return new Map(
    [...descriptions].map(([taskId, description]) => [
      taskId,
      getRichTextText(parseRichText(description)).toLocaleLowerCase(),
    ]),
  )
}

export default getTaskDescriptionTexts
