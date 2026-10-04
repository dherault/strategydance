import type { IntlShape } from 'react-intl'

import type { StreakDay } from '~types'

import formatCardDay from '~utils/buildInPublic/formatCardDay'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// What a day of a streak's week or calendar says to a screen reader, where its flame says it to
// the eye: the day, and whether it was active, kept by a charge, neither, or is still to come
function getStreakDayLabel({ formatMessage, formatDate }: IntlShape, day: StreakDay) {
  const values = { day: formatCardDay(formatDate, day.date) }

  if (day.isFuture) return formatMessage(buildInPublicMessages.dayToCome, values)

  if (day.isCharged) return formatMessage(buildInPublicMessages.dayCharged, values)

  return formatMessage(day.isOn ? buildInPublicMessages.dayActive : buildInPublicMessages.dayInactive, values)
}

export default getStreakDayLabel
