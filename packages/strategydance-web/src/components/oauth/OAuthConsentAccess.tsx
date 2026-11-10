import { useId } from 'react'
import { useIntl } from 'react-intl'
import type { ModuleName } from 'strategydance-core'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { Radio } from 'strategydance-design-system/components/ui/Radio'

import getModuleMessages from '~utils/module/getModuleMessages'
import type { OAuthConsentAccessLevel } from '~utils/oauth/readOAuthConsentModules'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  module: ModuleName
  access: OAuthConsentAccessLevel
  // Read and write is offered when the agent asked for it or the connection replaced held it, since
  // a consent never grants what neither was
  isWriteOffered: boolean
  // Not allowed is offered beside other modules, where the member may keep the agent out of one
  isNoneOffered: boolean
  // Labelled by the module's name, beside other modules, or "Access" when it is the only one
  isNamed: boolean
  onChange: (access: OAuthConsentAccessLevel) => void
  disabled: boolean
}

/*
  What the agent will be allowed to do in a module, worded by the module: read, or read and write,
  and beside other modules not at all. A module offered read alone shows it as a fact, there being
  nothing to choose
*/
function OAuthConsentAccess({ module, access, isWriteOffered, isNoneOffered, isNamed, onChange, disabled }: Props) {
  const { formatMessage } = useIntl()
  const id = useId()
  const messages = getModuleMessages(module)
  const labelId = `${id}-label`
  const label = formatMessage(isNamed ? messages.name : moduleMessages.accessLabel)

  if (!isWriteOffered && !isNoneOffered) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabelClassName}>{label}</span>
        <span className="text-sm text-foreground">{formatMessage(moduleMessages.readAccess)}</span>
        <span className="text-xs text-muted-foreground">{formatMessage(messages.readAccess)}</span>
      </div>
    )
  }

  const options: { value: OAuthConsentAccessLevel; label: string; hint: string }[] = [
    ...(isNoneOffered
      ? [
          {
            value: 'none' as const,
            label: formatMessage(moduleMessages.noAccess),
            hint: formatMessage(moduleMessages.noAccessHint),
          },
        ]
      : []),
    { value: 'read', label: formatMessage(moduleMessages.readAccess), hint: formatMessage(messages.readAccess) },
    ...(isWriteOffered
      ? [
          {
            value: 'write' as const,
            label: formatMessage(moduleMessages.readWriteAccess),
            hint: formatMessage(messages.writeAccess),
          },
        ]
      : []),
  ]

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
        {label}
      </span>
      {options.map(option => (
        <Radio
          key={option.value}
          name={`${id}-access`}
          label={option.label}
          hint={option.hint}
          checked={access === option.value}
          disabled={disabled}
          onChange={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

export default OAuthConsentAccess
