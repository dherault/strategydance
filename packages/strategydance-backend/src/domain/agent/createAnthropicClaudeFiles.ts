import Anthropic, { toFile } from '@anthropic-ai/sdk'

import type { ClaudeFiles } from '~types'

import getAnthropicClient from '~domain/agent/getAnthropicClient'

// How long an upload of a file, ten megabytes at most, may take before it fails, and the upload that
// asked for it answers the member to try again
const UPLOAD_TIMEOUT_MS = 60 * 1000

// How many files a page of the listing holds, the most the API gives
const LIST_PAGE_SIZE = 1000

/*
  The Files API, on the process's client (`getAnthropicClient`). Out of beta, so no header: a file is
  uploaded once, read by its id in every request after, and kept until it is deleted. A file already
  gone answers a delete with a 404, which counts as deleted, so every prune can delete twice
*/
function createAnthropicClaudeFiles(): ClaudeFiles {
  return {
    async upload({ name, contentType, bytes }) {
      const client = await getAnthropicClient()
      const file = await client.files.upload(
        { file: await toFile(bytes, name, { type: contentType }) },
        { timeout: UPLOAD_TIMEOUT_MS },
      )

      return file.id
    },

    async delete(id) {
      const client = await getAnthropicClient()

      try {
        await client.files.delete(id)
      } catch (error) {
        if (!(error instanceof Anthropic.NotFoundError)) throw error
      }
    },

    async *list() {
      const client = await getAnthropicClient()

      for await (const file of client.files.list({ limit: LIST_PAGE_SIZE })) {
        yield { id: file.id, name: file.filename, createdAt: file.created_at }
      }
    },
  }
}

export default createAnthropicClaudeFiles
