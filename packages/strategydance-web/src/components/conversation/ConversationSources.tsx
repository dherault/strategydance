import { useIntl } from 'react-intl'

import type { ConversationReplySource } from '~utils/conversation/groupConversationReplies'
import readConversationSourceDomain from '~utils/conversation/readConversationSourceDomain'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  sources: ConversationReplySource[]
}

/*
  The web pages a reply cites, under it, by the numbers its markers show: each page's title,
  linking to it, and the domain it is on
*/
function ConversationSources({ sources }: Props) {
  const { formatMessage } = useIntl()

  if (!sources.length) return null

  return (
    <section
      aria-label={formatMessage(conversationMessages.sources)}
      className="mt-3 flex flex-col gap-1.5 border-t pt-3"
    >
      <p className="text-xs font-medium text-muted-foreground">{formatMessage(conversationMessages.sources)}</p>
      <ol className="flex flex-col gap-1 text-sm">
        {sources.map(({ number, url, title }) => {
          const domain = readConversationSourceDomain(url)

          return (
            <li
              key={number}
              className="flex min-w-0 items-baseline gap-2"
            >
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{number}.</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="min-w-0 truncate text-primary underline-offset-2 hover:underline"
              >
                {title ?? domain}
              </a>
              {title ? <span className="shrink-0 text-xs text-muted-foreground">{domain}</span> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default ConversationSources
