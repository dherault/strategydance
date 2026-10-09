import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'

import { COMPANY_ASPECTS } from '~constants'

import toAspectSlug from '~utils/company/toAspectSlug'

import { TASK_EDITABLE_CLASS_NAME } from '~components/task/taskClassNames'

import aspectMessages from '~data/intl/aspectMessages'
import taskMessages from '~data/intl/messages/task'

type Props = {
  value: CompanyAspect[]
  onChange: (aspects: CompanyAspect[]) => void
}

// The aspects of the company a task is about, as badges, which a click turns into a list to pick
// them from. Each pick is a change of its own, and closing the list shows the badges again
function TaskAspectsField({ value, onChange }: Props) {
  const { formatMessage } = useIntl()
  const [isEditing, setIsEditing] = useState(false)

  const aspects = COMPANY_ASPECTS.filter(aspect => value.includes(aspect))

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{formatMessage(taskMessages.aspects)}</span>
      {isEditing ? (
        <MultiSelect
          defaultOpen
          value={value}
          placeholder={formatMessage(taskMessages.chooseAspects)}
          aria-label={formatMessage(taskMessages.aspects)}
          searchPlaceholder={formatMessage(taskMessages.searchAspects)}
          emptyText={formatMessage(taskMessages.noAspectsFound)}
          clearLabel={formatMessage(taskMessages.clear)}
          closeLabel={formatMessage(taskMessages.close)}
          moreLabel={count => formatMessage(taskMessages.moreChips, { count })}
          options={COMPANY_ASPECTS.map(aspect => ({ value: aspect, label: formatMessage(aspectMessages[aspect]) }))}
          onValueChange={values => onChange(values as CompanyAspect[])}
          onOpenChange={isOpen => {
            if (!isOpen) setIsEditing(false)
          }}
        />
      ) : (
        <button
          type="button"
          title={formatMessage(taskMessages.editAspects)}
          className={TASK_EDITABLE_CLASS_NAME}
          onClick={() => setIsEditing(true)}
        >
          {aspects.length ? (
            <span className="flex flex-wrap gap-1.5">
              {aspects.map(aspect => (
                <Badge
                  key={aspect}
                  size="sm"
                  icon={
                    <CompanyAspectIcon
                      aspect={toAspectSlug(aspect)}
                      size={12}
                    />
                  }
                >
                  {formatMessage(aspectMessages[aspect])}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{formatMessage(taskMessages.noAspects)}</span>
          )}
        </button>
      )}
    </div>
  )
}

export default TaskAspectsField
