import { type PropsWithChildren, useEffect } from 'react'

import type { MessageType } from '~types'

import useAppIntl from '~hooks/intl/useAppIntl'

import Loading from '~components/common/Loading'

type Props = PropsWithChildren<{
  messageTypes: MessageType[]
}>

/*
  Declares the catalogues the tree below it needs, and holds it back until they have loaded. A
  waiter, in other words, parameterized by what it waits on.

  `messageTypes` is in the dependency list even though callers pass an array literal, which is a new
  reference on every render: `registerMessages` returns the previous array unchanged when the effect
  brings nothing new, so a re-run costs a comparison and nothing else
*/
function IntlMessagesRegistration({ messageTypes, children }: Props) {
  const { registerMessages, loadedMessageTypes } = useAppIntl()

  useEffect(() => {
    registerMessages(messageTypes)
  }, [
    messageTypes,
    registerMessages,
  ])

  if (!messageTypes.every(type => loadedMessageTypes.includes(type))) {
    return (
      <Loading source="IntlMessagesRegistration" />
    )
  }

  return children
}

export default IntlMessagesRegistration
