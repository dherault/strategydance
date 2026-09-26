import { PencilIcon, UploadIcon } from 'lucide-react'

import OrganizationMark from '~components/organization/OrganizationMark'

type Props = {
  name: string
  logoUrl: string | null | undefined
  color: string | null | undefined
  // What the button does, for somebody who cannot see the icon it shows on hover
  label: string
  disabled?: boolean
  onClick: () => void
}

/*
  The organization's mark, large, in a white frame that overlaps the banner above it: the logo, or
  the initials on the color. It follows the form rather than what is saved, so a new name, color
  or logo shows here before it is saved.

  The whole frame is the button that changes the logo, with an upload or edit icon over it on
  hover and keyboard focus
*/
function OrganizationSettingsLogo({ name, logoUrl, color, label, disabled = false, onClick }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="group relative -mt-14 size-28 shrink-0 cursor-pointer overflow-hidden rounded-xs border-4 border-white bg-white p-0 shadow-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed"
    >
      <OrganizationMark
        name={name}
        logoUrl={logoUrl}
        color={color}
        className="size-full rounded-none text-4xl font-bold tracking-[-0.02em]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center bg-secondary/60 text-white opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0"
      >
        {logoUrl ? <PencilIcon className="size-5" /> : <UploadIcon className="size-5" />}
      </span>
    </button>
  )
}

export default OrganizationSettingsLogo
