// A date and a time of day, then up to nine digits of a second, then the zone, as RFC 3339 writes a
// timestamp and Data Connect answers one
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/i

/*
  A timestamp in microseconds since the epoch, to the microsecond Postgres keeps, which a
  millisecond's `Date.parse` would round away: two stamps within one millisecond still compare as
  the database orders them. Not a number for anything else
*/
function toTimestampMicroseconds(value: string) {
  const match = TIMESTAMP_PATTERN.exec(value)

  if (!match) return Number.NaN

  const [, time, fraction = '', zone] = match

  return Date.parse(`${time}${zone}`) * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6))
}

/*
  Whether one timestamp is the same as another or earlier, to the microsecond. False when either is
  not a timestamp, so a value nobody can read never passes for an earlier one
*/
export function isTimestampAtOrBefore(value: string, reference: string) {
  return toTimestampMicroseconds(value) <= toTimestampMicroseconds(reference)
}

// An id as the reach compares it, whichever form it came in: without dashes, in lowercase
function toComparableId(id: string) {
  return id.replaceAll('-', '').toLowerCase()
}

/*
  The organizations an external agent's connection reaches, among the member's memberships, in
  their order: those its list names whose membership was there when the list was last written,
  `grantedAt`, by Allow or by an edit on the Connected agents tab. The list references no membership,
  since a consent writes it in one row, so this is what stands in for a reference: an organization
  the member left, or that was deleted, has no membership to match, and one the member left and was
  invited back to has a membership newer than the grant, so an agent never finds itself acting as a
  member who has not chosen it since. Every reader of a connection's organizations goes through it
*/
export function readAgentConnectionReach<Membership extends { organizationId: string; createdAt: string }>(
  connection: { organizationIds: readonly string[]; grantedAt: string },
  memberships: readonly Membership[],
) {
  const listed = new Set(connection.organizationIds.map(toComparableId))

  return memberships.filter(
    ({ organizationId, createdAt }) =>
      listed.has(toComparableId(organizationId)) && isTimestampAtOrBefore(createdAt, connection.grantedAt),
  )
}
