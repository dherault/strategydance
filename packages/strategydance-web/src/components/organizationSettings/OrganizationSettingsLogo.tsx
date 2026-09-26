import OrganizationMark from '~components/organization/OrganizationMark'

type Props = {
  name: string
  logoUrl: string | null | undefined
  color: string | null | undefined
}

/*
  The organization's mark, large, in a white frame that overlaps the banner above it: the logo, or
  the initials on the color. It follows the form rather than what is saved, so a new name or color
  shows here before it is saved
*/
function OrganizationSettingsLogo({ name, logoUrl, color }: Props) {
  return (
    <div className="relative -mt-14 size-28 shrink-0 overflow-hidden rounded-xs border-4 border-white bg-white shadow-sm">
      <OrganizationMark
        name={name}
        logoUrl={logoUrl}
        color={color}
        className="size-full rounded-none text-4xl font-bold tracking-[-0.02em]"
      />
    </div>
  )
}

export default OrganizationSettingsLogo
