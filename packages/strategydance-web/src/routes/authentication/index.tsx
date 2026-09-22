import { createFileRoute } from '@tanstack/react-router'

import Authentication from '~components/authentication/Authentication'

export const Route = createFileRoute('/authentication/')({
  component: Authentication,
})
