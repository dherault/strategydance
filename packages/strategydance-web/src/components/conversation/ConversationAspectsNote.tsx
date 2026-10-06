import { useIntl } from 'react-intl'
import { type CompanyAspect, ConversationActor } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'

import { COMPANY_ASPECTS } from '~constants'

import toAspectSlug from '~utils/company/toAspectSlug'

import aspectMessages from '~data/intl/aspectMessages'
import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  aspects: CompanyAspect[]
  setBy: ConversationActor | null
}

/*
  A small centred note in the thread saying who changed the conversation's aspects, Strategy Dance
  or the reader, then the aspects it is tagged with, each a small icon and its name
*/
function ConversationAspectsNote({ aspects, setBy }: Props) {
  const { formatMessage } = useIntl()

  function getText() {
    if (setBy === ConversationActor.AGENT) return formatMessage(conversationMessages.aspectsTagged)

    return formatMessage(aspects.length ? conversationMessages.aspectsChanged : conversationMessages.aspectsRemoved)
  }

  return (
    <p className="m-0 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-xs text-muted-foreground">
      <span className="basis-full">{getText()}</span>
      {COMPANY_ASPECTS.filter(aspect => aspects.includes(aspect)).map(aspect => (
        <span
          key={aspect}
          className="inline-flex items-center gap-1 font-medium text-neutral-600"
        >
          <CompanyAspectIcon
            aspect={toAspectSlug(aspect)}
            size={12}
          />
          {formatMessage(aspectMessages[aspect])}
        </span>
      ))}
    </p>
  )
}

export default ConversationAspectsNote
