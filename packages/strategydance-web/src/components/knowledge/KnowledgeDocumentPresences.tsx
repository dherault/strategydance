import { useIntl } from 'react-intl'
import { Avatar, AvatarGroup } from 'strategydance-design-system/components/ui/Avatar'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { KnowledgeDocumentPresent } from '~utils/knowledge/createKnowledgeDocumentPresence'

import knowledgeMessages from '~data/intl/messages/knowledge'

// How many faces show before the rest are counted
const MAX_FACES = 4

type Props = {
  people: KnowledgeDocumentPresent[]
}

/*
  The teammates who have the document open with the reader, a face each, ringed in the color their
  caret is drawn in, and their name over it on hover. Past four, the fourth place counts the rest.
  Nothing when the reader is alone
*/
function KnowledgeDocumentPresences({ people }: Props) {
  const { formatMessage, formatList } = useIntl()

  if (!people.length) return null

  const shown = people.length > MAX_FACES ? people.slice(0, MAX_FACES - 1) : people
  const hiddenCount = people.length - shown.length

  return (
    <AvatarGroup
      role="group"
      aria-label={formatMessage(knowledgeMessages.alsoHere, {
        names: formatList(
          people.map(person => person.name),
          { type: 'conjunction' },
        ),
      })}
      className="shrink-0 *:ring-0 [&>*+*]:-ml-1.5"
    >
      {shown.map(person => (
        <Tooltip
          key={person.userId}
          content={person.name}
          side="bottom"
        >
          <Avatar
            size="sm"
            name={person.name}
            src={person.imageUrl ?? undefined}
            alt=""
            style={{ boxShadow: `0 0 0 2px var(--color-white), 0 0 0 4px ${person.color}` }}
          />
        </Tooltip>
      ))}
      {hiddenCount ? (
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600 shadow-[0_0_0_2px_var(--color-white)]"
        >
          {formatMessage(knowledgeMessages.moreHere, { count: hiddenCount })}
        </span>
      ) : null}
    </AvatarGroup>
  )
}

export default KnowledgeDocumentPresences
