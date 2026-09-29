import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { StreakDay } from '~types'

import toCalendarDate from '~utils/date/toCalendarDate'

import BuildInPublicFlame from '~components/buildInPublic/BuildInPublicFlame'

type Props = {
  days: StreakDay[]
  size: number
  // Tailwind's gap between the seven columns
  className?: string
  letterClassName?: string
}

// A week of flames, each over its day's initial, today's in the text color and bold, the days to
// come faded
function BuildInPublicWeekFlames({ days, size, className, letterClassName = 'text-[11px]' }: Props) {
  const { formatDate } = useIntl()

  return (
    <div className={cn('grid grid-cols-7', className)}>
      {days.map(day => (
        <div
          key={day.date}
          className="flex flex-col items-center gap-2"
        >
          <BuildInPublicFlame
            size={size}
            isLit={day.isOn}
            className={cn(day.isToday ? 'text-current' : 'text-(--flame-off)', day.isFuture && 'opacity-50')}
          />
          <span className={cn(letterClassName, day.isToday ? 'font-bold' : 'font-medium opacity-70')}>
            {formatDate(toCalendarDate(day.date), { weekday: 'narrow', timeZone: 'UTC' })}
          </span>
        </div>
      ))}
    </div>
  )
}

export default BuildInPublicWeekFlames
