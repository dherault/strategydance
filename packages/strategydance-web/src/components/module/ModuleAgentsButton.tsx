import { BotIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { ModuleName } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Dialog, DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'

import useCanUseModules from '~hooks/module/useCanUseModules'

import ModuleAgentsDialog from '~components/module/ModuleAgentsDialog'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  module: ModuleName
}

/*
  A module's page's "Use with your agents", which opens the dialog telling how to connect an agent
  of the member's own to it, and takes the focus back once it closes. Nothing for a reader who may
  not connect one yet, while modules are for Strategy Dance's administrators alone. It sits in the
  page's toolbar, so it takes the fields' height
*/
function ModuleAgentsButton({ module }: Props) {
  const { formatMessage } = useIntl()
  const canUseModules = useCanUseModules()

  if (!canUseModules) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          icon={<BotIcon />}
        >
          {formatMessage(moduleMessages.agentsButton)}
        </Button>
      </DialogTrigger>
      <ModuleAgentsDialog module={module} />
    </Dialog>
  )
}

export default ModuleAgentsButton
