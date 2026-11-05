import { useId } from 'react'
import { useIntl } from 'react-intl'
import { MAX_AGENT_CONNECTION_ORGANIZATIONS } from 'strategydance-core'
import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Organization } from '~types'

import OrganizationMark from '~components/organization/OrganizationMark'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  // Those the reader may choose, the organizations they are in, in the order they joined them
  organizations: Pick<Organization, 'id' | 'name' | 'logoUrl' | 'logoThumbnailUrl' | 'color'>[]
  chosenIds: string[]
  onChange: (chosenIds: string[]) => void
  disabled: boolean
}

/*
  Which of the reader's organizations an external agent acts in, ticked among theirs: at least one,
  and at most as many as a connection reaches, the others turning off once that many are ticked. The
  line under the label says what a choice means, that one is needed when none is ticked, or that no
  more can be once the cap is reached. The consent page and the Connected agents tab's edit both
  choose with it
*/
function AgentConnectionOrganizationsField({ organizations, chosenIds, onChange, disabled }: Props) {
  const { formatMessage } = useIntl()
  const id = useId()
  const messageId = `${id}-message`
  const isFull = chosenIds.length >= MAX_AGENT_CONNECTION_ORGANIZATIONS

  function toggle(organizationId: string, isChosen: boolean) {
    onChange(
      isChosen
        ? organizations
            .map(({ id: optionId }) => optionId)
            .filter(optionId => optionId === organizationId || chosenIds.includes(optionId))
        : chosenIds.filter(chosenId => chosenId !== organizationId),
    )
  }

  return (
    <fieldset
      aria-describedby={messageId}
      className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
    >
      {/* A legend takes no part in the fieldset's flex, so it keeps its own space below */}
      <legend className={cn(fieldLabelClassName, 'mb-1.5 p-0')}>
        {formatMessage(moduleMessages.organizationsLabel)}
      </legend>
      <p
        id={messageId}
        aria-live="polite"
        className={cn('m-0 text-xs', chosenIds.length ? 'text-muted-foreground' : 'text-danger')}
      >
        {!chosenIds.length
          ? formatMessage(moduleMessages.organizationsRequired)
          : isFull && organizations.length > MAX_AGENT_CONNECTION_ORGANIZATIONS
            ? formatMessage(moduleMessages.organizationsMax, { max: MAX_AGENT_CONNECTION_ORGANIZATIONS })
            : formatMessage(moduleMessages.organizationsHint)}
      </p>
      {organizations.map(organization => {
        const isChosen = chosenIds.includes(organization.id)

        return (
          <Checkbox
            key={organization.id}
            label={
              <span className="flex min-w-0 items-center gap-2">
                <OrganizationMark
                  name={organization.name}
                  logoUrl={organization.logoThumbnailUrl ?? organization.logoUrl}
                  color={organization.color}
                  size="sm"
                />
                <span className="truncate">{organization.name}</span>
              </span>
            }
            checked={isChosen}
            disabled={disabled || (!isChosen && isFull)}
            onChange={event => toggle(organization.id, event.target.checked)}
          />
        )
      })}
    </fieldset>
  )
}

export default AgentConnectionOrganizationsField
