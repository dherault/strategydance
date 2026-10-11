import type { ReactNode } from 'react'

type Props = {
  title: string
  description: string
  // What the member can do about it, under the description
  children?: ReactNode
}

// What the consent page says in place of the request, when there is nothing left to answer
function OAuthConsentNotice({ title, description, children }: Props) {
  return (
    <>
      <h1 className="m-0 text-4xl leading-[1.05] text-balance sm:text-5xl">{title}</h1>
      <p className="m-0 max-w-xl text-base leading-[1.6] text-pretty text-muted-foreground">{description}</p>
      {children}
    </>
  )
}

export default OAuthConsentNotice
