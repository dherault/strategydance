import { useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_CONVERSATION_MESSAGES } from 'strategydance-core'
import type { CompanyAspect } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import type { Conversation } from '~types'

import useUpdateConversationAspects from '~hooks/conversation/useUpdateConversationAspects'

import AspectsDialog from '~components/company/AspectsDialog'
import CompanyAspectIcons from '~components/company/CompanyAspectIcons'

import aspectMessages from '~data/intl/aspectMessages'
import conversationMessages from '~data/intl/messages/conversation'

// The aspects dialog's words, for a conversation. At module scope so the reference is stable
const CONVERSATION_ASPECTS_DIALOG_MESSAGES = {
  title: conversationMessages.aspectsTitle,
  description: conversationMessages.aspectsDescription,
  selected: conversationMessages.aspectsSelected,
  cancel: conversationMessages.cancel,
  save: conversationMessages.save,
  close: conversationMessages.close,
}

type Props = {
  // The stored conversation, or null for a draft
  conversation: Conversation | null
}

/*
  A conversation's title, in the display face, and under it its aspects as icons, a button that
  opens the dialog to change them, or "Add aspects" while it has none. A draft has its title alone:
  its aspects are sent with its first message.

  Saving the aspects adds a note to the thread, so the dialog waits for it to land and stays open
  when it cannot: once the conversation is full, which it says before a save as well, or when the
  save failed
*/
function ConversationHead({ conversation }: Props) {
  const { formatMessage, formatList } = useIntl()
  const updateAspects = useUpdateConversationAspects()
  const [isPicking, setIsPicking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [failure, setFailure] = useState<'full' | 'error' | null>(null)

  const isFull = conversation ? conversation.messageCount >= MAX_CONVERSATION_MESSAGES : false
  const shownFailure = isFull ? 'full' : failure

  async function saveAspects(aspects: CompanyAspect[]) {
    if (!conversation) return

    setIsSaving(true)
    setFailure(null)

    try {
      const result = await updateAspects(conversation, aspects)

      if (result === 'full') {
        setFailure('full')

        return
      }

      // Gone, the page says so as the live query lands
      setIsPicking(false)
    } catch (error) {
      console.error('The aspects could not be saved', error)
      setFailure('error')
    } finally {
      setIsSaving(false)
    }
  }

  function closeDialog() {
    setIsPicking(false)
    setFailure(null)
  }

  function renderAspects() {
    if (!conversation) return null

    const { aspects } = conversation
    const aspectNames = aspects.map(aspect => formatMessage(aspectMessages[aspect]))

    return (
      <button
        type="button"
        aria-label={
          aspects.length
            ? formatMessage(conversationMessages.editAspects, {
                aspects: formatList(aspectNames, { type: 'conjunction' }),
              })
            : undefined
        }
        onClick={() => setIsPicking(true)}
        className="-ml-1 flex h-8 cursor-pointer items-center self-start rounded-xs border-0 bg-transparent px-1 font-sans text-sm text-neutral-600 transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        {aspects.length ? (
          <CompanyAspectIcons
            aspects={aspects}
            size={18}
            className="gap-2 px-1"
          />
        ) : (
          <span className="px-1">{formatMessage(conversationMessages.addAspects)}</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <h1 className="m-0 font-display text-4xl leading-[1.1] font-normal tracking-tight text-pretty wrap-anywhere text-secondary">
        {conversation ? conversation.title : formatMessage(conversationMessages.newTitle)}
      </h1>
      {renderAspects()}
      {isPicking && conversation ? (
        <AspectsDialog
          aspects={conversation.aspects}
          messages={CONVERSATION_ASPECTS_DIALOG_MESSAGES}
          onSave={saveAspects}
          onClose={closeDialog}
          isSaving={isSaving}
          isSaveDisabled={isFull}
          alert={
            shownFailure ? (
              <Alert variant={shownFailure === 'full' ? 'warning' : 'danger'}>
                {formatMessage(
                  shownFailure === 'full' ? conversationMessages.aspectsFull : conversationMessages.aspectsError,
                )}
              </Alert>
            ) : null
          }
        />
      ) : null}
    </div>
  )
}

export default ConversationHead
