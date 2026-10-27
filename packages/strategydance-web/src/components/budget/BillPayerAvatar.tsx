import { Avatar } from 'strategydance-design-system/components/ui/Avatar'

import type { BillPayer } from '~types'

type Props = {
  payer: BillPayer
  size?: 'sm' | 'md'
}

// Who paid a bill, as a face: their picture, drawn from its thumbnail when it has one, or their initials
function BillPayerAvatar({ payer, size = 'sm' }: Props) {
  return (
    <Avatar
      src={payer.imageUrl ?? undefined}
      name={payer.name ?? undefined}
      size={size}
    />
  )
}

export default BillPayerAvatar
