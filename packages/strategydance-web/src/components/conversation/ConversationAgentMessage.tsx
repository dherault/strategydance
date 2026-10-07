import { useIntl } from 'react-intl'
import { CitationLink } from 'strategydance-design-system/components/ui/CitationLink'
import { Markdown, type MarkdownCitationMarker } from 'strategydance-design-system/components/ui/Markdown'

import type { ConversationReplySource } from '~utils/conversation/groupConversationReplies'
import readConversationSourceDomain from '~utils/conversation/readConversationSourceDomain'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  text: string
  // The markers after its cited spans, keyed by the numbers of `sources`
  markers?: MarkdownCitationMarker[]
  // Its reply's sources, numbered across the reply
  sources?: ConversationReplySource[]
}

/*
  What Strategy Dance wrote, full width, in the Markdown the thread draws, through the design
  system's `Markdown`, which keeps it to that subset and never loads an image. A span web search
  cited is followed by its sources' numbers, each linking to its page, which the reply lists under
  it. A link to knowledge reads as its words until the thread resolves them
*/
function ConversationAgentMessage({ text, markers = [], sources = [] }: Props) {
  const { formatMessage } = useIntl()

  function renderCitation(key: string) {
    const source = sources.find(({ number }) => String(number) === key)

    if (!source) return null

    return (
      <CitationLink
        number={source.number}
        href={source.url}
        label={formatMessage(conversationMessages.citationLabel, {
          number: source.number,
          title: source.title ?? readConversationSourceDomain(source.url),
        })}
      />
    )
  }

  return (
    <Markdown
      value={text}
      size="md"
      citations={markers}
      renderCitation={renderCitation}
      className="wrap-anywhere text-pretty"
    />
  )
}

export default ConversationAgentMessage
