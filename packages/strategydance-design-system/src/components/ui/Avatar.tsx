import { type VariantProps, cva } from 'class-variance-authority'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

const avatarVariants = cva(
  'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary-100 leading-none font-semibold text-secondary select-none',
  {
    variants: {
      size: {
        sm: 'size-6 text-[10px]',
        md: 'size-8 text-xs',
        lg: 'size-10 text-sm',
        xl: 'size-14 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
}

// The avatar renders its own image and initials, so it takes neither children nor `asChild`
type Props = Omit<ComponentProps<typeof AvatarPrimitive.Root>, 'asChild' | 'children'> & VariantProps<typeof avatarVariants> & {
  /** Falls back to the initials while it loads, and for good if it fails */
  src?: string
  /** Used for the initials, the alt text and the title */
  name?: string
  alt?: string
}

function Avatar({ src, name = '', alt, size, className, ...props }: Props) {
  // The initials take the image's name, so the avatar keeps one whether its image loads or not,
  // and an empty `alt` keeps them decorative as it keeps the image
  const label = alt ?? name

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      title={name || undefined}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {src
        ? (
            <AvatarPrimitive.Image
              src={src}
              alt={alt ?? name}
              className="size-full object-cover"
            />
          )
        : null}
      <AvatarPrimitive.Fallback
        role={label ? 'img' : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
      >
        {initialsOf(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

// Overlaps its avatars by 12px, each ringed in white
function AvatarGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn('flex *:ring-2 *:ring-white [&>*+*]:-ml-3', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarGroup, avatarVariants }
