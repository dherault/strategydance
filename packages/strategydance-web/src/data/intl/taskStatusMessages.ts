import type { MessageDescriptor } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'

import taskMessages from '~data/intl/messages/task'

// Each status's name in the reader's language, which is also its column's
const taskStatusMessages: Record<TaskStatus, MessageDescriptor> = {
  [TaskStatus.BACKLOG]: taskMessages.statusBacklog,
  [TaskStatus.TODO]: taskMessages.statusTodo,
  [TaskStatus.ONGOING]: taskMessages.statusOngoing,
  [TaskStatus.DONE]: taskMessages.statusDone,
}

export default taskStatusMessages
