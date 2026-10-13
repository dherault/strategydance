import type { ClaudeFile, ClaudeFiles } from '~types'

type Options = {
  // Fails the next uploads, deletes or listings, one error each, in the order they are called
  uploadFailures?: Error[]
  deleteFailures?: Error[]
}

/*
  The Files API for the tests, in memory: each upload is kept with its bytes, named and dated, a
  delete removes it whether or not it is there, and the listing reads them newest first, as the API
  does. `files` is what it holds, which a test can seed with a file no row names, and `calls` what
  it was asked, in order
*/
function createClaudeFilesFake({ uploadFailures = [], deleteFailures = [] }: Options = {}) {
  const files = new Map<string, ClaudeFile & { contentType: string; bytes: Uint8Array }>()
  const calls: string[] = []
  let count = 0

  const claudeFiles: ClaudeFiles = {
    async upload({ name, contentType, bytes }) {
      calls.push(`upload ${name}`)

      const failure = uploadFailures.shift()

      if (failure) throw failure

      count += 1

      const id = `file_${String(count).padStart(4, '0')}`

      files.set(id, { id, name, contentType, bytes, createdAt: new Date().toISOString() })

      return id
    },

    async delete(id) {
      calls.push(`delete ${id}`)

      const failure = deleteFailures.shift()

      if (failure) throw failure

      files.delete(id)
    },

    async *list() {
      calls.push('list')

      for (const file of [...files.values()].reverse()) yield file
    },
  }

  return { claudeFiles, files, calls }
}

export default createClaudeFilesFake
