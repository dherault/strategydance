import type { BetaContentBlock, BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { DirectoryBusinessModel, DirectoryCategory, MAX_DIRECTORY_DESCRIPTION_LENGTH } from 'strategydance-directories'
import { z } from 'zod'

import type { DirectoryReviewAnswer } from '~types'

import { MAX_DIRECTORY_EVIDENCE_LENGTH, MAX_DIRECTORY_NOTES_LENGTH } from '~domain/directories/directoryCheckSettings'
import { DIRECTORY_REVIEW_INACTIVE_REASONS } from '~domain/directories/directoryReviewPrompt'

const webUrlSchema = z.url({ protocol: /^https?$/ })

const answerSchema = z.object({
  verdict: z.enum(['ACTIVE', 'INACTIVE', 'INCONCLUSIVE']),
  inactiveReason: z.enum(DIRECTORY_REVIEW_INACTIVE_REASONS).nullable(),
  description: z.string().nullable(),
  isCurrentDescriptionAccurate: z.boolean(),
  categories: z.array(z.enum(Object.values(DirectoryCategory))),
  areCurrentCategoriesAccurate: z.boolean(),
  businessModel: z.enum(Object.values(DirectoryBusinessModel)).nullable(),
  evidence: z.object({ quote: z.string(), url: z.string() }).nullable(),
  submissionUrl: z.string().nullable(),
  notes: z.string(),
})

/*
  The answer of a review whose turn ended, as `buildDirectoryReviewRequest`'s schema has it: the
  text after the turn's last fetch, joined, since a fallback model carries on the text the declining
  one left. Null for anything else: a refusal, an answer cut at its `max_tokens`, or text that is not
  the schema's JSON.

  What the schema cannot hold is held here: a description longer than a sentence or on several lines
  is dropped rather than cut, as are a quote longer than a sentence or so, an `UNKNOWN` model, which
  says nothing, and an address that is not a web one. The categories are kept once each, in the
  enum's order, as the list holds them, and none at all says nothing. Notes past their length are cut, so a day's
  report fits a pull request's description
*/
function readDirectoryReview(message: BetaMessage, content: BetaContentBlock[]): DirectoryReviewAnswer | null {
  if (message.stop_reason !== 'end_turn') return null

  const lastFetch = content.findLastIndex(
    block => !['text', 'thinking', 'redacted_thinking', 'fallback'].includes(block.type),
  )
  const text = content
    .slice(lastFetch + 1)
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
  let json: unknown

  try {
    json = JSON.parse(text)
  } catch {
    return null
  }

  const parsed = answerSchema.safeParse(json)

  if (!parsed.success) return null

  const answer = parsed.data
  const description = answer.description?.trim() ?? ''
  const quote = answer.evidence?.quote.trim() ?? ''
  const isEvidenceValid =
    !!quote && quote.length <= MAX_DIRECTORY_EVIDENCE_LENGTH && webUrlSchema.safeParse(answer.evidence?.url).success
  const notes = answer.notes.trim()
  const categories = Object.values(DirectoryCategory).filter(category => answer.categories.includes(category))

  return {
    ...answer,
    description:
      description && description.length <= MAX_DIRECTORY_DESCRIPTION_LENGTH && !description.includes('\n')
        ? description
        : null,
    categories: categories.length ? categories : null,
    businessModel: answer.businessModel === DirectoryBusinessModel.UNKNOWN ? null : answer.businessModel,
    evidence: isEvidenceValid ? answer.evidence : null,
    submissionUrl: webUrlSchema.safeParse(answer.submissionUrl).success ? answer.submissionUrl : null,
    notes:
      notes.length > MAX_DIRECTORY_NOTES_LENGTH
        ? `${notes.slice(0, MAX_DIRECTORY_NOTES_LENGTH - 1).trimEnd()}…`
        : notes,
  }
}

export default readDirectoryReview
