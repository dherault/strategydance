import { createFileRoute, redirect } from '@tanstack/react-router'

// The administration opens on its users
export const Route = createFileRoute('/-/_app/administration/')({
  beforeLoad: () => {
    throw redirect({ to: '/-/administration/users', replace: true })
  },
})
