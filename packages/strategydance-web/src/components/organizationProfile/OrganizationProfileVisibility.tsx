import { useId } from 'react'
import { useIntl } from 'react-intl'
import { Switch } from 'strategydance-design-system/components/ui/Switch'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

type Props = {
  isPublic: boolean
  disabled?: boolean
  onChange: (isPublic: boolean) => void
}

/*
  Whether anybody may see the organization's profile, or only its members, with a hint saying
  which the switch is set to.

  A Switch in a form that submits, against the design system's advice to use a Checkbox there,
  because the design has it so: flipping it applies nothing by itself, and marks the form changed
  until it is saved or discarded with the rest. The switch sits at the end of the row, after its
  label, as the design lays it out, which the Switch's own labelled row does not do
*/
function OrganizationProfileVisibility({ isPublic, disabled = false, onChange }: Props) {
  const { formatMessage } = useIntl()
  const switchId = useId()
  const hintId = `${switchId}-hint`

  return (
    <div className="flex w-full max-w-100 items-start justify-between gap-4 font-sans">
      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor={switchId}
          className="text-sm font-medium text-foreground"
        >
          {formatMessage(organizationProfileMessages.publicLabel)}
        </label>
        <p
          id={hintId}
          className="m-0 text-xs leading-normal text-muted-foreground"
        >
          {formatMessage(isPublic ? organizationProfileMessages.publicHintPublic : organizationProfileMessages.publicHintPrivate)}
        </p>
      </div>
      <Switch
        id={switchId}
        checked={isPublic}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        aria-describedby={hintId}
      />
    </div>
  )
}

export default OrganizationProfileVisibility
