import { createFileRoute } from '@tanstack/react-router'

import AuthenticationPasswordReset from '~components/authentication/AuthenticationPasswordReset'

export const Route = createFileRoute('/authentication/password-reset')({
  component: AuthenticationPasswordReset,
})
