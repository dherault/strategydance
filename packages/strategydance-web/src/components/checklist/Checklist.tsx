import { EyeIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Select } from 'strategydance-design-system/components/ui/Select'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useDefaultChecklistItems from '~hooks/checklist/useDefaultChecklistItems'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getMemberName from '~utils/team/getMemberName'

import ChecklistTable from '~components/checklist/ChecklistTable'
import PageSection from '~components/layout/PageSection'

import checklistMessages from '~data/intl/messages/checklist'

/*
  The habits a member ticks every day: the reader's own to begin with, and any teammate's through
  the picker, read only. A teammate who leaves while picked falls back to the reader's own.

  The reader's own starts with the default habits the first time they open it
*/
function Checklist() {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const { data: team } = useOrganizationTeam()

  const viewerId = viewer?.uid ?? null
  const [pickedUserId, setPickedUserId] = useState(viewerId)

  useDefaultChecklistItems()

  const members = team.userOrganizations
  const ownerId = members.some(({ user }) => user.id === pickedUserId) ? pickedUserId : viewerId
  const isOwn = ownerId === viewerId

  return (
    <PageSection
      title={formatMessage(checklistMessages.title)}
      description={formatMessage(checklistMessages.description)}
      actions={(
        <div className="flex items-center gap-3">
          {isOwn
            ? null
            : (
                <span className="hidden items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground sm:inline-flex [&_svg]:size-4">
                  <EyeIcon aria-hidden="true" />
                  {formatMessage(checklistMessages.viewOnly)}
                </span>
              )}
          <Select
            value={ownerId ?? undefined}
            onValueChange={setPickedUserId}
            aria-label={formatMessage(checklistMessages.showFor)}
            options={members.map(member => ({ value: member.user.id, label: getMemberName(member) }))}
            className="w-50"
          />
        </div>
      )}
    >
      {ownerId
        ? (
            <ChecklistTable
              key={ownerId}
              userId={ownerId}
              isOwn={isOwn}
            />
          )
        : null}
    </PageSection>
  )
}

export default Checklist
