import { SearchIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'
import { Select } from 'strategydance-design-system/components/ui/Select'

import type { OrganizationMember, TaskAssigneeFilter } from '~types'

import { COMPANY_ASPECTS } from '~constants'

import toTaskAssigneeValue from '~utils/task/toTaskAssigneeValue'
import getMemberName from '~utils/team/getMemberName'

import TaskAssigneeAvatar from '~components/task/TaskAssigneeAvatar'

import aspectMessages from '~data/intl/aspectMessages'
import taskMessages from '~data/intl/messages/task'

type Props = {
  query: string
  assignee: TaskAssigneeFilter
  aspects: CompanyAspect[]
  members: readonly OrganizationMember[]
  viewerId: string | null
  isFiltering: boolean
  onQueryChange: (query: string) => void
  onAssigneeChange: (assignee: TaskAssigneeFilter) => void
  onAspectsChange: (aspects: CompanyAspect[]) => void
  onClear: () => void
}

// What narrows the board: words its tasks hold, whose they are, and what they are about, with a way
// back to every task once any of them is set
function TaskBoardFilters({
  query,
  assignee,
  aspects,
  members,
  viewerId,
  isFiltering,
  onQueryChange,
  onAssigneeChange,
  onAspectsChange,
  onClear,
}: Props) {
  const { formatMessage } = useIntl()

  const viewer = members.find(member => member.user.id === viewerId) ?? null

  function renderOption(label: string, member: OrganizationMember | null, isAgent = false) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <TaskAssigneeAvatar
          member={member}
          isAgent={isAgent}
        />
        <span className="truncate">{label}</span>
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-45 flex-[0_1_280px]">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500"
        />
        <Input
          value={query}
          placeholder={formatMessage(taskMessages.searchPlaceholder)}
          aria-label={formatMessage(taskMessages.searchPlaceholder)}
          className="pl-9"
          onChange={event => onQueryChange(event.target.value)}
        />
      </div>
      <Select
        value={assignee}
        aria-label={formatMessage(taskMessages.assigneeFilterLabel)}
        className="min-w-40 flex-[0_1_200px]"
        options={[
          { value: 'all', label: formatMessage(taskMessages.everyone) },
          { value: 'me', label: renderOption(formatMessage(taskMessages.assignedToMe), viewer) },
          { value: 'agent', label: renderOption(formatMessage(taskMessages.strategyDance), null, true) },
          ...members
            .filter(member => member.user.id !== viewerId)
            .map(member => ({
              value: toTaskAssigneeValue({ assigneeId: member.user.id, isAssignedToAgent: false }),
              label: renderOption(getMemberName(member), member),
            })),
        ]}
        onValueChange={value => onAssigneeChange(value as TaskAssigneeFilter)}
      />
      <MultiSelect
        value={aspects}
        placeholder={formatMessage(taskMessages.aspectsFilterPlaceholder)}
        aria-label={formatMessage(taskMessages.aspectsFilterLabel)}
        searchPlaceholder={formatMessage(taskMessages.searchAspects)}
        emptyText={formatMessage(taskMessages.noAspectsFound)}
        clearLabel={formatMessage(taskMessages.clear)}
        closeLabel={formatMessage(taskMessages.close)}
        moreLabel={count => formatMessage(taskMessages.moreChips, { count })}
        className="min-w-45 flex-[0_1_240px]"
        options={COMPANY_ASPECTS.map(aspect => ({ value: aspect, label: formatMessage(aspectMessages[aspect]) }))}
        onValueChange={values => onAspectsChange(values as CompanyAspect[])}
      />
      {isFiltering ? (
        <Button
          variant="transparent"
          onClick={onClear}
        >
          {formatMessage(taskMessages.clearFilters)}
        </Button>
      ) : null}
    </div>
  )
}

export default TaskBoardFilters
