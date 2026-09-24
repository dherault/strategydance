import { createFileRoute, redirect } from '@tanstack/react-router'

// The authenticated area opens on the aspects of the company to explore
export const Route = createFileRoute('/-/')({
  beforeLoad: () => {
    throw redirect({ to: '/-/explore', replace: true })
  },
})
