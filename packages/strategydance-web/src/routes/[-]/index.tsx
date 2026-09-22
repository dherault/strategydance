import { createFileRoute } from '@tanstack/react-router'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useUser from '~hooks/user/useUser'

export const Route = createFileRoute('/-/')({
  component: AuthenticatedIndexRoute,
})

// A placeholder, so deliberately not translated: every string here is going away with it
function AuthenticatedIndexRoute() {
  const { data: user } = useUser()
  const { signOut } = useAuthentication()

  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">
        Authenticated
      </h1>
      <pre className="w-full overflow-auto rounded-md bg-muted p-4 text-xs">
        {JSON.stringify(user, null, 2)}
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
