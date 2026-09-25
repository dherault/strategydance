import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { ERROR_CODE_TEAM_FULL, type InvitationFailureReason, type InviteOrganizationMembersData, MAX_INVITATIONS_PER_REQUEST, MAX_TEAM_SIZE } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import parseInvitationEmails from '~utils/team/parseInvitationEmails'

import Spinner from '~components/common/Spinner'

import { ApiError, requestApi } from '~data/api'
import teamMessages from '~data/intl/messages/team'

// How many addresses an error lists before it says how many more there are
const LISTED_EMAILS = 3

// Each reason an address can come back not invited, in the order the toasts are raised
const FAILURE_REASONS: InvitationFailureReason[] = ['taken', 'full', 'forbidden', 'error']

type Failure = 'conflict' | 'full' | 'rateLimit' | 'error'

type Props = {
  organizationId: string
  organizationName: string
  memberEmails: string[]
  invitedEmails: string[]
  onClose: () => void
}

/*
  Invites people by email: a field that takes a list, and the backend, which creates the
  invitations and emails their links.

  The field checks what it holds against the team already on the page: what is not an address,
  who is a member, who is invited, and whether the team has room. It says so once the reader leaves the field or tries to send,
  not while they are still typing an address, and starts over as soon as they type again. The
  backend checks the same things, for whatever changed since the page last heard. Mounted only
  while open, so it starts empty every time
*/
function InviteMembersDialog({ organizationId, organizationName, memberEmails, invitedEmails, onClose }: Props) {
  const { formatList, formatMessage } = useIntl()

  const [text, setText] = useState('')
  const [isTouched, setIsTouched] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const parsed = parseInvitationEmails(text, new Set(memberEmails), new Set(invitedEmails))
  const count = parsed.valid.length
  const room = Math.max(0, MAX_TEAM_SIZE - memberEmails.length - invitedEmails.length)

  function listEmails(emails: string[]) {
    if (emails.length <= LISTED_EMAILS) return formatList(emails, { type: 'conjunction' })

    return formatList([...emails.slice(0, LISTED_EMAILS), formatMessage(teamMessages.emailListMore, { count: emails.length - LISTED_EMAILS })], { type: 'conjunction' })
  }

  const problems = [
    parsed.invalid.length ? formatMessage(teamMessages.invalidEmails, { count: parsed.invalid.length, emails: listEmails(parsed.invalid) }) : null,
    parsed.members.length ? formatMessage(teamMessages.alreadyMembers, { count: parsed.members.length, emails: listEmails(parsed.members) }) : null,
    parsed.invited.length ? formatMessage(teamMessages.alreadyInvited, { emails: listEmails(parsed.invited) }) : null,
    count > MAX_INVITATIONS_PER_REQUEST ? formatMessage(teamMessages.tooManyInvitations, { max: MAX_INVITATIONS_PER_REQUEST }) : null,
    count > room ? formatMessage(teamMessages.teamFull, { room, max: MAX_TEAM_SIZE }) : null,
  ].filter(problem => problem !== null)

  const failedEmailMessages = {
    taken: teamMessages.invitationsTaken,
    full: teamMessages.invitationsNoRoom,
    forbidden: teamMessages.invitationsForbidden,
    error: teamMessages.invitationsNotSent,
  }

  const failureMessages: Record<Failure, string> = {
    conflict: formatMessage(teamMessages.inviteConflictError),
    full: formatMessage(teamMessages.inviteTeamFullError),
    rateLimit: formatMessage(teamMessages.inviteRateLimitError),
    error: formatMessage(teamMessages.inviteError),
  }

  const error = isTouched && problems.length
    ? problems.join(' ')
    : failure
      ? failureMessages[failure]
      : undefined

  const canSend = count > 0 && problems.length === 0 && !isSending

  async function send() {
    setIsTouched(true)

    if (!canSend) return

    setIsSending(true)
    setFailure(null)

    try {
      const { invitedEmails: sentEmails, failedEmails } = await requestApi<InviteOrganizationMembersData>({
        method: 'POST',
        path: `/organizations/${organizationId}/invitations`,
        body: { emails: parsed.valid },
      })

      /*
        Some can go out while others do not, since each address is inserted on its own. The
        reader hears about both: what went out, and every address that did not, grouped by why
      */
      if (sentEmails.length) toast.success(formatMessage(teamMessages.invitationsSent, { count: sentEmails.length, email: sentEmails[0] }))

      FAILURE_REASONS.forEach(reason => {
        const emails = failedEmails.filter(failed => failed.reason === reason).map(({ email }) => email)

        if (emails.length) toast.error(formatMessage(failedEmailMessages[reason], { emails: listEmails(emails) }))
      })

      onClose()
    }
    catch (sendError) {
      console.error('Failed to send the invitations', sendError)

      if (sendError instanceof ApiError && sendError.code === ERROR_CODE_TEAM_FULL) setFailure('full')
      else if (sendError instanceof ApiError && sendError.status === 409) setFailure('conflict')
      else if (sendError instanceof ApiError && sendError.status === 429) setFailure('rateLimit')
      else setFailure('error')
    }
    finally {
      setIsSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }

  // A new line is how the field separates addresses, so sending takes the modifier as well
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      send()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(teamMessages.close)}
        className="sm:max-w-[560px]"
      >
        <form
          onSubmit={handleSubmit}
          className="grid gap-6"
        >
          <DialogHeader>
            <DialogTitle>
              {formatMessage(teamMessages.inviteTitle)}
            </DialogTitle>
            <DialogDescription>
              {formatMessage(teamMessages.inviteDescription, { organizationName })}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            label={formatMessage(teamMessages.inviteEmailsLabel)}
            value={text}
            onChange={event => {
              setText(event.target.value)
              setIsTouched(false)
              setFailure(null)
            }}
            onBlur={() => setIsTouched(true)}
            onKeyDown={handleKeyDown}
            // Two messages joined here rather than one holding a newline, which a translation
            // came back with as a literal backslash and n
            placeholder={`${formatMessage(teamMessages.inviteEmailsExample)}\n${formatMessage(teamMessages.inviteEmailsOnePerLine)}`}
            hint={formatMessage(teamMessages.inviteEmailsHint)}
            error={error}
            rows={5}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4 sm:items-center">
            <span
              aria-live="polite"
              className="min-w-0 flex-1 text-sm text-muted-foreground"
            >
              {count
                ? (
                    <FormattedMessage
                      {...teamMessages.invitationsReady}
                      values={{
                        count,
                        b: chunks => (
                          <strong className="font-medium text-secondary">
                            {chunks}
                          </strong>
                        ),
                      }}
                    />
                  )
                : formatMessage(teamMessages.noEmailsYet)}
            </span>
            <Button
              variant="transparent"
              onClick={onClose}
            >
              {formatMessage(teamMessages.cancel)}
            </Button>
            <Button
              type="submit"
              disabled={!canSend}
              icon={isSending ? <Spinner tone="current" /> : undefined}
            >
              {formatMessage(teamMessages.sendInvitations, { count })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default InviteMembersDialog
