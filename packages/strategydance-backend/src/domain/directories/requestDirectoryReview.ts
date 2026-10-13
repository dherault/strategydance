import type { BetaContentBlock, BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { Directory, InactiveDirectory } from 'strategydance-directories'

import type { ClaudeClient, DirectoryCheckUsage, DirectoryProbe, DirectoryReview } from '~types'

import logger from '~utils/logger'

import stripBeforeFallback from '~domain/agent/stripBeforeFallback'
import buildDirectoryReviewRequest from '~domain/directories/buildDirectoryReviewRequest'
import collectFetchedPages from '~domain/directories/collectFetchedPages'
import { DIRECTORY_REVIEW_TIMEOUT_MS, MAX_DIRECTORY_REVIEW_PAUSES } from '~domain/directories/directoryCheckSettings'
import readDirectoryReview from '~domain/directories/readDirectoryReview'

/*
  Has Claude review a directory from what the probe read, fetching what more it needs from the
  site, within one deadline for the whole review. A turn web fetch paused is sent back to carry on,
  as many as `MAX_DIRECTORY_REVIEW_PAUSES` times, and what a model that declined partway wrote
  before its fallback took over is dropped, as a conversation's turn drops it.

  A refusal, an answer past its schema, a turn still paused or the deadline is `unanswered`: the
  check told nothing, and the directory waits its turn again. A failure of the API itself is
  `failed`, and the directory is left as it was, to be picked again the next day
*/
async function requestDirectoryReview(
  directory: Directory | InactiveDirectory,
  probe: DirectoryProbe,
  claude: ClaudeClient,
): Promise<DirectoryReview> {
  const signal = AbortSignal.timeout(DIRECTORY_REVIEW_TIMEOUT_MS)
  let parts: BetaContentBlock[][] = []
  let usage: DirectoryCheckUsage = {
    inputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: 0,
  }

  for (let pauses = 0; ; pauses++) {
    let message: BetaMessage

    try {
      message = await claude.stream(buildDirectoryReviewRequest(directory, probe, parts), {
        signal,
        onProgress: () => {},
      })
    } catch (error) {
      if (signal.aborted) return { outcome: 'unanswered', failure: 'The review timed out', usage }

      logger.warn(`Directories: the review of ${directory.name} failed`, error)

      return { outcome: 'failed', failure: error instanceof Error ? error.message : String(error), usage }
    }

    usage = addUsage(usage, message)
    parts = stripBeforeFallback([...parts, message.content]).filter(part => part.length)

    if (message.stop_reason === 'pause_turn' && pauses < MAX_DIRECTORY_REVIEW_PAUSES) continue

    const content = parts.flat()
    const answer = readDirectoryReview(message, content)

    if (!answer) {
      const failure =
        message.stop_reason === 'refusal'
          ? `Claude refused, ${message.stop_details?.category ?? 'no category'}, and so did its fallback`
          : `Claude answered nothing the review reads, stopping on ${message.stop_reason}`

      logger.warn(`Directories: ${directory.name}: ${failure}`)

      return { outcome: 'unanswered', failure, usage }
    }

    return { outcome: 'answered', answer, fetchedPages: collectFetchedPages(content), usage }
  }
}

function addUsage(usage: DirectoryCheckUsage, { usage: added }: BetaMessage): DirectoryCheckUsage {
  return {
    inputTokens: usage.inputTokens + added.input_tokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens + (added.cache_creation_input_tokens ?? 0),
    cacheReadInputTokens: usage.cacheReadInputTokens + (added.cache_read_input_tokens ?? 0),
    outputTokens: usage.outputTokens + added.output_tokens,
  }
}

export default requestDirectoryReview
