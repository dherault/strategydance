import type { ModuleCaller } from '~types'

// The uid a bill's payer names: `"me"`, the caller, or a member as `member:<id>`, as a task's
// assignee names one
function parseBillPayer(value: string, caller: ModuleCaller) {
  return value === 'me' ? caller.userId : value.slice('member:'.length)
}

export default parseBillPayer
