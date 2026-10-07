/*
  The gRPC status code a Google Cloud client's error carries, google-gax's `Status`, or null for an
  error without one, such as a connection that failed before any answer
*/
function readGrpcCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null

  return typeof error.code === 'number' ? error.code : null
}

export default readGrpcCode
