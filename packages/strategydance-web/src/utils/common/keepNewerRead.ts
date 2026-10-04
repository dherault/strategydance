import { replaceEqualDeep } from '@tanstack/react-query'

/*
  A query's `structuralSharing` that keeps the cached result when the next one is older, as
  `isOlder` tells, and otherwise shares what did not change, as TanStack does by default.

  TanStack runs it on every write to the query, a read's result and `setQueryData` alike, so a
  result that lands late never replaces a newer one, whichever way each came: the SDK hands a live
  query's subscribers its cached result when they subscribe and every result a read of the same
  query brings, and a first read can finish after the subscription's first push
*/
function keepNewerRead<Data>(isOlder: (cached: Data, next: Data) => boolean) {
  return (cached: unknown, next: unknown): unknown =>
    cached !== undefined && isOlder(cached as Data, next as Data) ? cached : replaceEqualDeep(cached, next)
}

export default keepNewerRead
