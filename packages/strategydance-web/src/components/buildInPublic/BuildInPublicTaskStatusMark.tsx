import { ArrowRightIcon, CalendarIcon, CheckIcon } from 'lucide-react'
import { TaskStatus } from 'strategydance-database/web'
import { cn } from 'strategydance-design-system/lib/utils'

// A wave across the box's middle, filled below, as a task half done
const WAVE_PATH = 'M0 24 C6.67 24 6.67 16 13.33 16 S20 24 26.67 24 S33.33 16 40 16 V40 H0 Z'

type Props = {
  status: TaskStatus
  className?: string
}

/*
  Where a task stands, as a large box on a card: ticked and filled in the mark color once done,
  half filled by a wave while ongoing, an arrow when it is to do next, a calendar while it waits in
  the backlog. Decorative, since the line above it says the same in words
*/
function BuildInPublicTaskStatusMark({ status, className }: Props) {
  const isDone = status === TaskStatus.DONE

  return (
    <span
      className={cn(
        'box-border grid size-11 flex-none place-items-center overflow-hidden rounded-xs border-[1.5px] border-(--card-mark)',
        isDone ? 'bg-(--card-mark) text-(--card-box-check)' : 'text-(--card-mark)',
        className,
      )}
    >
      {isDone ? (
        <CheckIcon
          size={26}
          strokeWidth={3}
          aria-hidden="true"
        />
      ) : status === TaskStatus.ONGOING ? (
        <svg
          viewBox="0 0 40 40"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block size-full"
        >
          <path
            d={WAVE_PATH}
            fill="var(--card-mark)"
          />
        </svg>
      ) : status === TaskStatus.TODO ? (
        <ArrowRightIcon
          size={22}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      ) : (
        <CalendarIcon
          size={22}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

export default BuildInPublicTaskStatusMark
