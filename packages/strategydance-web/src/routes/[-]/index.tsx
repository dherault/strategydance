import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useOrganization from '~hooks/organization/useOrganization'
import useUser from '~hooks/user/useUser'

import { Button } from '~components/ui/Button'
import { Input } from '~components/ui/Input'

export const Route = createFileRoute('/-/')({
  component: AuthenticatedIndexRoute,
})

// A placeholder, so deliberately not translated: every string here is going away with it
function AuthenticatedIndexRoute() {
  const { data: user } = useUser()
  const { signOut } = useAuthentication()
  const { data: memberships, organization, role, setOrganizationId, createOrganization } = useOrganization()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const trimmedName = name.trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!trimmedName || creating) return

    setCreating(true)

    try {
      await createOrganization(trimmedName)

      // Only on success. A create that failed leaves what was typed where it was typed
      setName('')
    }
    catch (error) {
      console.error('Failed to create the organization', error)
    }
    finally {
      setCreating(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">
        Authenticated
      </h1>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md items-center gap-2"
      >
        <Input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Organization name"
          aria-label="Organization name"
        />
        <Button
          type="submit"
          loading={creating}
          disabled={!trimmedName}
        >
          Create
        </Button>
      </form>
      {/*
        Controlled in both states: with no memberships `organization` is null and the empty value
        matches the placeholder option, and with memberships the provider's derivation guarantees
        `organization` is one of them
      */}
      <select
        value={organization?.id ?? ''}
        onChange={event => setOrganizationId(event.target.value)}
        disabled={!memberships.length}
        aria-label="Current organization"
        className="h-9 w-full max-w-md cursor-pointer rounded-md bg-muted px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!memberships.length && (
          <option value="">
            No organization yet
          </option>
        )}
        {memberships.map(({ organization: { id, name: organizationName } }) => (
          <option
            key={id}
            value={id}
          >
            {organizationName}
          </option>
        ))}
      </select>
      <pre className="w-full overflow-auto rounded-md bg-muted p-4 text-xs">
        {JSON.stringify({ user, organization, role, memberships }, null, 2)}
      </pre>
      <button
        type="button"
        onClick={signOut}
        className="cursor-pointer text-sm text-muted-foreground hover:underline"
      >
        Sign out
      </button>
    </main>
  )
}
