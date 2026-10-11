import { useIntl } from 'react-intl'
import { CitationLink } from 'strategydance-design-system/components/ui/CitationLink'
import { Markdown, type MarkdownCitationMarker } from 'strategydance-design-system/components/ui/Markdown'

import type { KnowledgeDocumentSummary, Task } from '~types'

import type { ConversationReplySource } from '~utils/conversation/groupConversationReplies'
import readConversationSourceDomain from '~utils/conversation/readConversationSourceDomain'

import ConversationDocumentLink from '~components/conversation/ConversationDocumentLink'
import ConversationTaskLink from '~components/conversation/ConversationTaskLink'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  text: string
  // The markers after its cited spans, keyed by the numbers of `sources`
  markers?: MarkdownCitationMarker[]
  // Its reply's sources, numbered across the reply
  sources?: ConversationReplySource[]
  // The organization's documents by id, which its links to knowledge draw, or null while not read
  documents?: ReadonlyMap<string, KnowledgeDocumentSummary> | null
  // The organization's board by task id, which its links to tasks draw, or null while not read
  tasks?: ReadonlyMap<string, Task> | null
  // Small in a dock's window, which is narrow
  size?: 'sm' | 'md'
}

/*
  What Strategy Dance wrote, full width, in the Markdown the thread draws, through the design
  system's `Markdown`, which keeps it to that subset and never loads an image. A span web search
  cited is followed by its sources' numbers, each linking to its page, which the reply lists under
  it. A link to knowledge draws the document's current title, and a link to a task the task's
  current name, or the agent's words struck through once the document or the task is gone
*/
function ConversationAgentMessage({
  text,
  markers = [],
  sources = [],
  documents = null,
  tasks = null,
  size = 'md',
}: Props) {
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
      size={size}
      citations={markers}
      renderCitation={renderCitation}
      renderLink={({ href, children }) =>
        href.startsWith('task:') ? (
          <ConversationTaskLink
            href={href}
            tasks={tasks}
          >
            {children}
          </ConversationTaskLink>
        ) : (
          <ConversationDocumentLink
            href={href}
            documents={documents}
          >
            {children}
          </ConversationDocumentLink>
        )
      }
      className="wrap-anywhere text-pretty"
    />
  )
}

export default ConversationAgentMessage
