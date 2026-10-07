import { CloudTasksClient } from '@google-cloud/tasks'

let client: CloudTasksClient | null = null

/*
  The one Cloud Tasks client, on Application Default Credentials, like the Firebase Admin SDK: on
  Cloud Run the service's own account, which needs Cloud Tasks' enqueuer role to queue a run, its
  viewer role to look a task up, and `roles/iam.serviceAccountUser` on `conversation-tasks` to give a
  task that account's token.

  Made on first use, so development, which queues nothing, never makes it
*/
function getCloudTasksClient() {
  client ??= new CloudTasksClient()

  return client
}

export default getCloudTasksClient
