import { MODULES, readModuleAddress } from 'strategydance-core'

/*
  Whether a connected agent can take a task up from the Delegate prompt: its address serves the
  Tasks module, the Tasks module's own or the one address, it holds the board's read there, and it
  reaches the task's organization
*/
function canDelegateTaskThrough(
  connection: { module: string; scopes: readonly string[]; organizations: readonly { id: string }[] },
  organizationId: string | undefined,
) {
  const tasks = MODULES.find(({ name }) => name === 'tasks')

  return Boolean(
    tasks
    && organizationId
    && readModuleAddress(connection.module)?.modules.includes(tasks.name)
    && connection.scopes.includes(tasks.scopes.read)
    && connection.organizations.some(({ id }) => id === organizationId),
  )
}

export default canDelegateTaskThrough
