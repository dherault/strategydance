import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/-/account/security')({
  component: AccountSecurityRoute,
})

function AccountSecurityRoute() {
  return null
}
