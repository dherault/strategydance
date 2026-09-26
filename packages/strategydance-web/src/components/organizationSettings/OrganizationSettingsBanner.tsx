import { type PropsWithChildren, useState } from 'react'

type Props = PropsWithChildren<{
  // Null for no banner, which leaves the band empty
  src: string | null | undefined
  alt: string
}>

/*
  The band across the top of the settings card: the organization's banner at 4:1, cropped to fill
  it, over a neutral band when there is none or it fails to load. `children` sit in its top right
  corner, where the button that changes it goes
*/
function OrganizationSettingsBanner({ src, alt, children }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  return (
    <div className="relative grid aspect-[4/1] place-items-center overflow-hidden rounded-t-xs border-b border-border bg-neutral-100">
      {src && src !== failedSrc
        ? (
            <img
              src={src}
              alt={alt}
              onError={() => setFailedSrc(src)}
              className="absolute inset-0 size-full object-cover"
            />
          )
        : null}
      {children
        ? (
            <div className="absolute top-3 right-3">
              {children}
            </div>
          )
        : null}
    </div>
  )
}

export default OrganizationSettingsBanner
