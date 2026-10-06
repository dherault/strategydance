import { createFileRoute, redirect } from '@tanstack/react-router'

// An organization's own address opens on its today
export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$organizationSlug/today', params, replace: true })
  },
})
