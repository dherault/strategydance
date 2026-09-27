import { createFileRoute, redirect } from '@tanstack/react-router'

// The authenticated area opens on today
export const Route = createFileRoute('/-/')({
  beforeLoad: () => {
    throw redirect({ to: '/-/today', replace: true })
  },
})
