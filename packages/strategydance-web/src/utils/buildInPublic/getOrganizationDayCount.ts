import getDaysBetween from '~utils/date/getDaysBetween'
import getLocalDate from '~utils/date/getLocalDate'

// Which day of its life an organization is on, the day it was made being day 1, in the reader's
// zone. Never less than 1, for an organization made in a zone that is ahead of theirs
function getOrganizationDayCount(createdAt: string, today: string) {
  return Math.max(1, getDaysBetween(getLocalDate(new Date(createdAt)), today) + 1)
}

export default getOrganizationDayCount
