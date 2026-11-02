import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { ConversationAuthor } from '~types'

import getConversationAuthorName from '~utils/conversation/getConversationAuthorName'

type Props = {
  author: ConversationAuthor
  size?: 'sm' | 'md'
  // Whether the name shows in a tooltip, where nothing beside the face says it
  hasTooltip?: boolean
}

// Who started a conversation, as a face: their picture, drawn from its thumbnail when it has one,
// or their initials, named for assistive technology and, where nothing else says it, in a tooltip
function ConversationAuthorAvatar({ author, size = 'sm', hasTooltip = false }: Props) {
  const name = getConversationAuthorName(author)
  const avatar = (
    <Avatar
      src={author.imageThumbnailUrl ?? author.imageUrl ?? undefined}
      name={name}
      size={size}
      className="shrink-0"
    />
  )

  return hasTooltip ? <Tooltip content={name}>{avatar}</Tooltip> : avatar
}

export default ConversationAuthorAvatar
