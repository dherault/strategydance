import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/-/account/')({
  component: AccountProfileRoute,
})

function AccountProfileRoute() {
  return null
}
