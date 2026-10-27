// A UUID as Data Connect writes one back and `createId` makes one: 32 hex digits, no dashes
const BILL_ID_PATTERN = /^[0-9a-f]{32}$/

// Whether an address's segment can name a bill at all, so one that cannot is a page that does not
// exist rather than a bill looked for in vain
function isBillId(value: string) {
  return BILL_ID_PATTERN.test(value)
}

export default isBillId
