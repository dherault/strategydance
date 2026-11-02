import { useIntl } from 'react-intl'
import { Select } from 'strategydance-design-system/components/ui/Select'

import type { ConversationAuthor, ConversationAuthorFilter as AuthorFilter } from '~types'

import getConversationAuthorName from '~utils/conversation/getConversationAuthorName'

import ConversationAuthorAvatar from '~components/conversation/ConversationAuthorAvatar'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  value: AuthorFilter
  // The reader, when they started a conversation the list holds, and the other members who did
  viewer: ConversationAuthor | null
  authors: ConversationAuthor[]
  onChange: (value: AuthorFilter) => void
}

// Whose conversations the list shows: everybody's, the reader's, or one other member's, each with
// their face, as the board's filter offers whose tasks it shows
function ConversationAuthorFilter({ value, viewer, authors, onChange }: Props) {
  const { formatMessage } = useIntl()

  function renderOption(label: string, author: ConversationAuthor | null) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        {author ? <ConversationAuthorAvatar author={author} /> : null}
        <span className="truncate">{label}</span>
      </span>
    )
  }

  return (
    <Select
      value={value}
      aria-label={formatMessage(conversationMessages.authorFilterLabel)}
      className="min-w-40 flex-[0_1_220px]"
      options={[
        { value: 'all', label: formatMessage(conversationMessages.authorFilterEveryone) },
        { value: 'me', label: renderOption(formatMessage(conversationMessages.authorFilterMine), viewer) },
        ...authors.map(author => ({
          value: `user:${author.id}`,
          label: renderOption(getConversationAuthorName(author), author),
        })),
      ]}
      onValueChange={selected => onChange(selected as AuthorFilter)}
    />
  )
}

export default ConversationAuthorFilter
