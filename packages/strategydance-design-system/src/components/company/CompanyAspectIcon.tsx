import {
  BoxIcon,
  ChessKnightIcon,
  CodeXmlIcon,
  HandshakeIcon,
  type LucideProps,
  MegaphoneIcon,
  PaletteIcon,
  ScaleIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'

// The aspects of a company, in order, each with its canonical Lucide icon
const CompanyAspects = [
  { id: 'strategy', label: 'Strategy', lucide: 'chess-knight' },
  { id: 'people', label: 'People and operations', lucide: 'users' },
  { id: 'finances', label: 'Finances', lucide: 'wallet' },
  { id: 'product', label: 'Product', lucide: 'box' },
  { id: 'engineering', label: 'Engineering', lucide: 'code-xml' },
  { id: 'design', label: 'Design', lucide: 'palette' },
  { id: 'marketing', label: 'Marketing, growth and distribution', lucide: 'megaphone' },
  { id: 'sales', label: 'Sales', lucide: 'handshake' },
  { id: 'legal', label: 'Legal', lucide: 'scale' },
] as const

type CompanyAspect = typeof CompanyAspects[number]['id']

const icons = {
  strategy: ChessKnightIcon,
  people: UsersIcon,
  finances: WalletIcon,
  product: BoxIcon,
  engineering: CodeXmlIcon,
  design: PaletteIcon,
  marketing: MegaphoneIcon,
  sales: HandshakeIcon,
  legal: ScaleIcon,
}

type Props = Omit<LucideProps, 'ref'> & {
  aspect: CompanyAspect
  /** In px. Defaults to 16 */
  size?: number
  /** The accessible name. Without one the icon is decorative */
  title?: string
}

function CompanyAspectIcon({ aspect, size = 16, title, ...props }: Props) {
  const Icon = icons[aspect]

  return (
    <Icon
      data-slot="company-aspect-icon"
      size={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    />
  )
}

export { CompanyAspectIcon, CompanyAspects }
export type { CompanyAspect }
