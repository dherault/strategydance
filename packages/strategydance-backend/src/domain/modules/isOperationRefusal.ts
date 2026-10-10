// Whether a module's operation failed on one of its checks, by a part of the message that check
// gives, as Data Connect puts it in the error
function isOperationRefusal(error: unknown, message: string) {
  return error instanceof Error && error.message.includes(message)
}

export default isOperationRefusal
