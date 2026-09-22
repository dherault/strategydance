type Props = {
  className?: string
}

// A black box, standing in until there is artwork. Deliberately a solid shape rather than a
// wordmark: it reads as unfinished, which is what it is
function Logo({ className }: Props) {
  return (
    <div
      role="presentation"
      className={className ? `aspect-square bg-black ${className}` : 'aspect-square bg-black'}
    />
  )
}

export default Logo
