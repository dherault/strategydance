import type { ClaudeFiles } from '~types'

import createId from '~utils/createId'

/*
  The Files API's stand-in in development, beside the placeholder client
  (`CONVERSATION_AGENT=placeholder`), which reads no file: an upload answers an id of its own and
  keeps nothing, and the listing is empty, so a sweep finds nothing to delete. A conversation whose
  files were uploaded so cannot be answered by the real model later, which reads no such id
*/
function createPlaceholderClaudeFiles(): ClaudeFiles {
  return {
    async upload() {
      return `placeholder-${createId()}`
    },

    async delete() {},

    async *list() {},
  }
}

export default createPlaceholderClaudeFiles
