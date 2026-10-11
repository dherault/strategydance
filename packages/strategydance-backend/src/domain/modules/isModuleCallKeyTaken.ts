// The unique index of `ModuleCallResult`'s key, which Data Connect names in the error of an insert
// under a key taken already
const MODULE_CALL_RESULT_KEY_INDEX = 'module_call_result_pkey'

// Whether a write failed because a call under the same idempotency key wrote first
function isModuleCallKeyTaken(error: unknown) {
  return error instanceof Error && error.message.includes(MODULE_CALL_RESULT_KEY_INDEX)
}

export default isModuleCallKeyTaken
