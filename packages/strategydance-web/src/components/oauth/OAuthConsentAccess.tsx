import { useId } from 'react'
import { useIntl } from 'react-intl'
import type { ModuleName } from 'strategydance-core'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { Radio } from 'strategydance-design-system/components/ui/Radio'

import getModuleMessages from '~utils/module/getModuleMessages'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  module: ModuleName
  // The agent asked for read and write, which the member may reduce to read. A request for read is
  // offered read alone, since a consent never grants more than was asked
  isWriteAsked: boolean
  isWriteChosen: boolean
  onChange: (isWriteChosen: boolean) => void
  disabled: boolean
}

// What the agent will be allowed to do in the module, worded by the module: read, or read and write
function OAuthConsentAccess({ module, isWriteAsked, isWriteChosen, onChange, disabled }: Props) {
  const { formatMessage } = useIntl()
  const id = useId()
  const messages = getModuleMessages(module)
  const labelId = `${id}-label`

  if (!isWriteAsked) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabelClassName}>{formatMessage(moduleMessages.accessLabel)}</span>
        <span className="text-sm text-foreground">{formatMessage(moduleMessages.readAccess)}</span>
        <span className="text-xs text-muted-foreground">{formatMessage(messages.readAccess)}</span>
      </div>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="flex flex-col gap-3"
    >
      <span
        id={labelId}
        className={fieldLabelClassName}
      >
        {formatMessage(moduleMessages.accessLabel)}
      </span>
      <Radio
        name={`${id}-access`}
        label={formatMessage(moduleMessages.readAccess)}
        hint={formatMessage(messages.readAccess)}
        checked={!isWriteChosen}
        disabled={disabled}
        onChange={() => onChange(false)}
      />
      <Radio
        name={`${id}-access`}
        label={formatMessage(moduleMessages.readWriteAccess)}
        hint={formatMessage(messages.writeAccess)}
        checked={isWriteChosen}
        disabled={disabled}
        onChange={() => onChange(true)}
      />
    </div>
  )
}

export default OAuthConsentAccess
