import { QueryFetchPolicy } from 'firebase/data-connect'
import { MAX_CONVERSATION_MESSAGES } from 'strategydance-core'
import {
  type CompanyAspect,
  ConversationActor,
  getConversation,
  updateConversationAspects,
} from 'strategydance-database/web'

import type { Conversation } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

// What `UpdateConversationAspects` says when the position it was given is no longer the counter's,
// the conversation is full, or it is gone
const POSITION_REFUSAL = 'aspects could not take a note at that position'

// How many times a save reads the counter again when a run's messages took the position first
const MAX_ATTEMPTS = 3

export type ConversationAspectsSave = 'saved' | 'full' | 'gone'

function isSameAspects(a: CompanyAspect[], b: CompanyAspect[]) {
  return a.length === b.length && a.every(aspect => b.includes(aspect))
}

/*
  Tags a conversation with aspects as the reader's, with the note that says so in its thread, at the
  position the conversation's counter is at. A run that inserted a message first moved the counter,
  and the mutation is refused: the conversation is read again from the server and the save tried at
  the new position, a few times at most. The same refusal says when the conversation is full or
  gone, which the read tells apart.

  Any other failure may have landed or not: the conversation is read again, and the save counts as
  done when it holds the aspects sent, as the reader's, so a lost answer never writes a second note.
  An unchanged set saves nothing, as the design has it.

  Throws when the save failed for any other reason
*/
function useUpdateConversationAspects() {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  return async (conversation: Conversation, aspects: CompanyAspect[]): Promise<ConversationAspectsSave> => {
    if (!organizationId || !viewerId) throw new Error('No organization or viewer to save aspects for')

    if (isSameAspects(conversation.aspects, aspects)) return 'saved'

    const key = { organizationId, id: conversation.id }
    let current: Conversation | null = conversation

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (!current) return 'gone'
      if (current.messageCount >= MAX_CONVERSATION_MESSAGES) return 'full'

      try {
        await updateConversationAspects(dataConnect, {
          ...key,
          userId: viewerId,
          aspects,
          position: current.nextMessagePosition,
        })

        return 'saved'
      } catch (error) {
        const isRefused = error instanceof Error && error.message.includes(POSITION_REFUSAL)
        const { data } = await getConversation(dataConnect, key, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })

        current = data.conversations[0] ?? null

        if (!isRefused) {
          if (current?.aspectsSetBy === ConversationActor.MEMBER && isSameAspects(current.aspects, aspects)) {
            return 'saved'
          }

          throw error
        }
      }
    }

    throw new Error('The conversation kept taking messages before its aspects could be saved')
  }
}

export default useUpdateConversationAspects
