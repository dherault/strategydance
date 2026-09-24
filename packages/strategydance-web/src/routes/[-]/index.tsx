import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Select } from 'strategydance-design-system/components/ui/Select'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUser from '~hooks/user/useUser'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'

export const Route = createFileRoute('/-/')({
  component: AuthenticatedIndexRoute,
})

// A placeholder, so deliberately not translated: every string here is going away with it
function AuthenticatedIndexRoute() {
  const { data: user } = useUser()
  const { signOut } = useAuthentication()
  const { data: userOrganizations, createOrganization } = useUserOrganizations()
  const { organization, role, setOrganizationId } = useCurrentOrganization()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const trimmedName = name.trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!trimmedName || creating) return

    setCreating(true)

    try {
      /*
        Creating and choosing are two concerns and two providers, so the page is what joins them.
        The id is safe to choose the moment it arrives: the create refetched before answering, so
        the list already holds the row it names
      */
      const organizationId = await createOrganization(trimmedName)

      setOrganizationId(organizationId)

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
      <h1 className="text-2xl">
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
          disabled={creating || !trimmedName}
          icon={creating ? <Spinner tone="current" /> : undefined}
        >
          Create
        </Button>
      </form>
      {/*
        Controlled in both states: with none of them `organization` is null and the empty value
        shows the placeholder, and with some the provider's derivation guarantees `organization`
        is one of them
      */}
      <Select
        value={organization?.id ?? ''}
        onValueChange={setOrganizationId}
        disabled={!userOrganizations.length}
        placeholder="No organization yet"
        aria-label="Current organization"
        options={userOrganizations.map(({ organization: { id, name: organizationName } }) => ({
          value: id,
          label: organizationName,
        }))}
        className="max-w-md"
      />
      <pre className="w-full overflow-auto rounded-md bg-muted p-4 text-xs">
        {JSON.stringify({ user, organization, role, userOrganizations }, null, 2)}
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
