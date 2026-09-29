import { useQueryClient } from '@tanstack/react-query'
import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { updateLogEntry } from 'strategydance-database/web'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { LogEntry, OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import LogEditor from '~components/log/LogEditor'

import { dataConnect } from '~data/firebase'
import logMessages from '~data/intl/messages/log'

type Props = {
  organizationId: string
  entry: LogEntry
  author: OrganizationMember
  // The reader's own entry, which they may rewrite
  isViewer: boolean
}

/*
  One entry of the log, under who wrote it and what they do, and whether they edited it since. The
  reader's own opens in the editor from its pencil.

  The entry is drawn by the design system's `RichText`, never by Lexical or as HTML, since it is
  somebody else's words for every reader but one
*/
function LogPost({ organizationId, entry, author, isViewer }: Props) {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const name = getMemberName(author)
  const isEdited = new Date(entry.updatedAt).getTime() > new Date(entry.createdAt).getTime()
  const details = [author.jobTitle, isEdited ? formatMessage(logMessages.edited) : null].filter(Boolean).join(' · ')

  async function save(content: string) {
    setIsPending(true)

    try {
      await updateLogEntry(dataConnect, { organizationId, id: entry.id, content })

      await queryClient.invalidateQueries({ queryKey: ['GetOrganizationLog', organizationId] })
      toast.success(formatMessage(logMessages.updated))
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save the log entry', error)

      toast.error(formatMessage(logMessages.saveError))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xs border border-neutral-200 bg-white p-6">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          src={author.user.imageUrl ?? undefined}
          name={name}
          size="lg"
        />
        <span className="flex min-w-0 flex-1 flex-col text-sm leading-[1.4]">
          <span className="truncate font-medium text-secondary">{name}</span>
          {details ? <span className="truncate text-xs text-muted-foreground">{details}</span> : null}
        </span>
        {isViewer && !isEditing ? (
          <Button
            variant="transparent"
            size="sm"
            icon={<PencilIcon />}
            aria-label={formatMessage(logMessages.editEntry)}
            className="-mt-1 -mr-1 self-start"
            onClick={() => setIsEditing(true)}
          />
        ) : null}
      </div>
      {isEditing ? (
        <LogEditor
          initialValue={entry.content}
          placeholder={formatMessage(logMessages.editPlaceholder)}
          submitLabel={formatMessage(logMessages.save)}
          submitHint={logMessages.saveHint}
          isPending={isPending}
          onSubmit={save}
          onCancel={() => setIsEditing(false)}
          autoFocus
        />
      ) : (
        <RichText value={entry.content} />
      )}
    </article>
  )
}

export default LogPost
