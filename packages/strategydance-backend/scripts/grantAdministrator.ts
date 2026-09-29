import { dataConnect } from '~firebase'

/*
  Makes somebody an administrator of Strategy Dance in the emulators, and nowhere else:

    bun run grant:administrator <email>

  The account has to have signed in once, since that is what creates its row. The app shows the
  administration section the next time it reads the reader's row, which a focus of its window does.

  The mutation is sent as GraphQL through the Admin SDK rather than declared in the backend's
  connector, so nothing that grants the flag is ever deployed. The Admin SDK would reach the real
  project from any machine holding Application Default Credentials, so the script refuses to run
  unless it points at the emulator, which the package's `grant:administrator` script does
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run grant:administrator <email>`',
  )
  process.exit(1)
}

// Firebase lowercases the addresses it stores, which are the ones the rows mirror
const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Usage: bun run grant:administrator <email>')
  process.exit(1)
}

const { data } = await dataConnect.executeGraphql<{ user_updateMany: number }, { email: string }>(
  `mutation GrantAdministrator($email: String!) {
    user_updateMany(where: { email: { eq: $email } }, data: { isAdministrator: true, updatedAt_expr: "request.time" })
  }`,
  { variables: { email } },
)

if (!data.user_updateMany) {
  console.error(`Nobody has signed in as ${email} in the emulators yet. Sign in once, then run this again`)
  process.exit(1)
}

console.log(`${email} is now an administrator of Strategy Dance`)
