import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { StreakDay } from '~types'

import getStreakDayLabel from '~utils/buildInPublic/getStreakDayLabel'
import toCalendarDate from '~utils/date/toCalendarDate'

import BuildInPublicBattery from '~components/buildInPublic/BuildInPublicBattery'
import BuildInPublicFlame from '~components/buildInPublic/BuildInPublicFlame'

type Props = {
  days: StreakDay[]
  size: number
  // Tailwind's gap between the seven columns
  className?: string
  letterClassName?: string
}

// A week of flames, each over its day's initial, today's in the text color and bold, the days to
// come faded, and a battery for a day a charge kept. Each day is named for a screen reader, since
// its flame is the only sign it was active
function BuildInPublicWeekFlames({ days, size, className, letterClassName = 'text-[11px]' }: Props) {
  const intl = useIntl()

  return (
    <div className={cn('grid grid-cols-7', className)}>
      {days.map(day => (
        <div
          key={day.date}
          role="img"
          aria-label={getStreakDayLabel(intl, day)}
          className="flex flex-col items-center gap-2"
        >
          {day.isCharged ? (
            <BuildInPublicBattery
              size={size}
              className="text-(--flame-charge)"
            />
          ) : (
            <BuildInPublicFlame
              size={size}
              isLit={day.isOn}
              className={cn(day.isToday ? 'text-current' : 'text-(--flame-off)', day.isFuture && 'opacity-50')}
            />
          )}
          <span
            aria-hidden="true"
            className={cn(letterClassName, day.isToday ? 'font-bold' : 'font-medium opacity-70')}
          >
            {intl.formatDate(toCalendarDate(day.date), { weekday: 'narrow', timeZone: 'UTC' })}
          </span>
        </div>
      ))}
    </div>
  )
}

export default BuildInPublicWeekFlames
