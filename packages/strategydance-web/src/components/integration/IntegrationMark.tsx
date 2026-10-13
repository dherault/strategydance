import { cn } from 'strategydance-design-system/lib/utils'

import getIntegrationMarkUrl from '~utils/integration/getIntegrationMarkUrl'

type Props = {
  name: string
  catalogueSlug: string | null
  className?: string
}

/*
  A server's mark on a small tile: the external MCP server's own when it was added from one the app
  has a mark for, its name's initial otherwise. Decorative: the name always stands beside it
*/
function IntegrationMark({ name, catalogueSlug, className }: Props) {
  const markUrl = getIntegrationMarkUrl(catalogueSlug)

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-xs bg-neutral-100 text-sm font-semibold text-secondary',
        className,
      )}
    >
      {markUrl ? (
        <img
          src={markUrl}
          alt=""
          width={18}
          height={18}
          className="block size-[18px]"
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  )
}

export default IntegrationMark
