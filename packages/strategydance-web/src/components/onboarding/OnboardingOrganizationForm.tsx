import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_ORGANIZATION_BRIEF_LENGTH, MAX_ORGANIZATION_NAME_LENGTH } from 'strategydance-core'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'

import onboardingMessages from '~data/intl/messages/onboarding'

/*
  The onboarding's last screen, where the reader creates their company with its name and brief,
  both required. A field left empty says so once the form is sent, as the design has it, rather
  than holding the button back.

  Creating is what sends the reader on, and this form does not navigate: the create refetches the
  memberships before it answers, `OnboardingBouncer` sees the first one arrive and takes the reader
  to today. So the button keeps spinning after a success, until the page goes. A failure keeps
  what was typed, for the next try
*/
function OnboardingOrganizationForm() {
  const { formatMessage } = useIntl()
  const { createOrganization } = useUserOrganizations()
  const { setOrganizationId } = useCurrentOrganization()

  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [isNameMissing, setIsNameMissing] = useState(false)
  const [isBriefMissing, setIsBriefMissing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isCreating) return

    const trimmedName = name.trim()
    const trimmedBrief = brief.trim()

    setIsNameMissing(!trimmedName)
    setIsBriefMissing(!trimmedBrief)

    if (!trimmedName || !trimmedBrief) return

    setIsCreating(true)
    setHasFailed(false)

    try {
      const organizationId = await createOrganization(trimmedName, trimmedBrief)

      setOrganizationId(organizationId)
      toast.success(formatMessage(onboardingMessages.created, { organizationName: trimmedName }))
    }
    catch (error) {
      console.error('Failed to create the organization', error)

      setHasFailed(true)
      setIsCreating(false)
    }
  }

  return (
    <div className="flex w-full max-w-[640px] animate-in flex-col items-center gap-6 px-6 py-12 text-center duration-500 ease-in-out fade-in slide-in-from-bottom-2">
      <h1 className="m-0 text-5xl leading-[1.1] text-balance">
        {formatMessage(onboardingMessages.title)}
      </h1>
      <p className="m-0 text-lg text-pretty">
        {formatMessage(onboardingMessages.lead)}
      </p>
      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-4 flex w-full max-w-[360px] flex-col gap-3 text-left"
      >
        <Input
          label={formatMessage(onboardingMessages.nameLabel)}
          value={name}
          onChange={event => {
            setName(event.target.value)
            setIsNameMissing(false)
          }}
          placeholder={formatMessage(onboardingMessages.namePlaceholder)}
          error={isNameMissing ? formatMessage(onboardingMessages.nameRequired) : undefined}
          maxLength={MAX_ORGANIZATION_NAME_LENGTH}
          autoComplete="organization"
          readOnly={isCreating}
          autoFocus
        />
        <Textarea
          label={formatMessage(onboardingMessages.briefLabel)}
          value={brief}
          onChange={event => {
            setBrief(event.target.value)
            setIsBriefMissing(false)
          }}
          placeholder={formatMessage(onboardingMessages.briefPlaceholder)}
          hint={formatMessage(onboardingMessages.briefHint)}
          error={isBriefMissing ? formatMessage(onboardingMessages.briefRequired) : undefined}
          maxLength={MAX_ORGANIZATION_BRIEF_LENGTH}
          rows={4}
          autosize
          readOnly={isCreating}
        />
        {hasFailed
          ? (
              <Alert variant="danger">
                {formatMessage(onboardingMessages.createError)}
              </Alert>
            )
          : null}
        <Button
          type="submit"
          size="lg"
          disabled={isCreating}
          icon={isCreating ? <Spinner tone="current" /> : undefined}
          className="w-full"
        >
          {formatMessage(onboardingMessages.submit)}
        </Button>
      </form>
    </div>
  )
}

export default OnboardingOrganizationForm
