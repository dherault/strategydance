import { CameraIcon } from 'lucide-react'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'

type Props = {
  src: string | null
  // For the initials shown where there is no picture
  name: string
  // What the button does, for somebody who cannot see the icon it shows on hover
  label: string
  disabled?: boolean
  onClick: () => void
}

/*
  The reader's picture, large, ringed in white: the photo, or their initials. It follows the form
  rather than what is saved, so a picture chosen shows here before it is saved.

  The whole avatar is the button that opens the picture's dialog, with a camera over it on hover
  and keyboard focus
*/
function AccountProfilePhoto({ src, name, label, disabled = false, onClick }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="group relative shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary disabled:cursor-not-allowed"
    >
      <Avatar
        src={src ?? undefined}
        name={name}
        // The button carries the name of what it does, so the picture inside it is decoration
        alt=""
        className="size-32 text-4xl shadow-sm ring-4 ring-white"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center rounded-full bg-secondary/60 text-white opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0"
      >
        <CameraIcon className="size-6" />
      </span>
    </button>
  )
}

export default AccountProfilePhoto
