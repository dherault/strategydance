import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'

/*
  Serves Data Connect on a real Postgres, where writers side by side meet as they do in production,
  which neither the person's emulator nor any one emulator does:

    bun run emulators:postgres                        # serves it until Ctrl-C
    bun scripts/withPostgresEmulators.ts <command>…   # runs the command against it, then stops it

  The emulator runs one operation at a time, whatever database it is on: given a real Postgres in
  place of its PGlite, a write on a row nobody locked still waits behind one blocked on a lock, and
  never more than one of its connections works at once. So this starts a throwaway Postgres in
  Docker, several emulators on it, each with connections of its own, and a proxy in front of them
  that hands each request to the next emulator in turn. Each operation is a request of its own, a
  transaction where it takes several steps, so any emulator serves any of them, and two writers'
  operations on two emulators meet in Postgres, as two of Data Connect's servers' do.

  Everything listens on ports nothing listens on, so the person's emulators and their data are left
  alone. The emulators serve this checkout's schema and connectors, which the first migrates into the
  empty database, and reload connectors as they change on disk; a schema changed while it runs would
  have every emulator migrate it at once, so restart it instead. Postgres logs every lock wait past a
  millisecond and every deadlock, which is how a race tells writers that met from writers that
  never did.

  The emulators are firebase-tools' own binary, configured with the database as the CLI configures
  it when `FIREBASE_DATACONNECT_POSTGRESQL_STRING` is set, through its `emulator/configure`, rather
  than through `firebase emulators:start`, which runs one emulator, and gives its binary some four
  seconds to compile the schema before giving up, which a loaded machine outlasts.

  The command runs with `DATA_CONNECT_EMULATOR_HOST` pointing at the proxy and
  `RACES_POSTGRES_CONTAINER` naming the container, and the script exits with its status. Nothing is
  kept: the container, the emulators and their directory go once it ends. It needs Docker running
*/

// The major version of Postgres served, PGlite's, as production's Cloud SQL instance was not read
const POSTGRES_IMAGE = 'postgres:17'

const PASSWORD = 'races'

// How many emulators serve the database, each running one operation at a time: as many as the
// writers most races release at once
const EMULATOR_COUNT = 4

// Where each search for a port nothing listens on starts, clear of the person's stack and of the
// scratch suites other sessions run
const FIRST_POSTGRES_PORT = 5440
const FIRST_EMULATOR_PORT = 9410
const FIRST_PROXY_PORT = 9430

// How long an emulator may take to compile the schema and connectors, and the first to migrate them
const EMULATOR_START_TIMEOUT_MS = 300_000

const repositoryRoot = resolve(import.meta.dir, '../../..')
const databasePackage = resolve(repositoryRoot, 'packages/strategydance-database')
const firebaseTools = resolve(repositoryRoot, 'node_modules/firebase-tools')

const command = process.argv.slice(2)

function run(argv: string[]) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(argv, { stdout: 'pipe', stderr: 'pipe' })

  return { isSuccess: exitCode === 0, stdout: stdout.toString().trim(), stderr: stderr.toString().trim() }
}

function findFreePort(from: number, taken: number[] = []) {
  for (let port = from; port < from + 100; port++) {
    if (!taken.includes(port) && !run(['lsof', '-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN']).stdout) return port
  }

  throw new Error(`No port is free from ${from} to ${from + 99}`)
}

type EmulatorInfo = { dataconnect: Record<string, { downloadPathRelativeToCacheDir: string }> }

// Where firebase-tools keeps the emulator binary of the version it pins, which it downloads first
// when it is not there
async function findEmulatorBinary() {
  const info = (await Bun.file(
    join(firebaseTools, 'lib/emulator/downloadableEmulatorInfo.json'),
  ).json()) as EmulatorInfo
  const platform =
    process.platform === 'darwin'
      ? process.arch === 'arm64'
        ? 'darwin_arm64'
        : 'darwin'
      : process.platform === 'win32'
        ? 'win32'
        : 'linux'
  const details = info.dataconnect[platform]

  if (!details) throw new Error(`firebase-tools has no Data Connect emulator for ${platform}`)

  const binary = join(
    process.env.FIREBASE_EMULATORS_PATH ?? join(homedir(), '.cache/firebase/emulators'),
    details.downloadPathRelativeToCacheDir,
  )

  if (!existsSync(binary)) {
    const setup = run([join(repositoryRoot, 'node_modules/.bin/firebase'), 'setup:emulators:dataconnect'])

    if (!setup.isSuccess || !existsSync(binary))
      throw new Error(`The emulator could not be downloaded: ${setup.stderr}`)
  }

  return binary
}

type Datasource = { datasource: { postgresql: { database: string } } }

async function readService() {
  const yaml = Bun.YAML.parse(await readFile(join(databasePackage, 'dataconnect.yaml'), 'utf8')) as {
    serviceId: string
    schemas?: Datasource[]
    schema?: Datasource
  }
  const schema = yaml.schemas?.[0] ?? yaml.schema

  if (!schema) throw new Error('dataconnect.yaml names no schema')

  return { serviceId: yaml.serviceId, database: schema.datasource.postgresql.database }
}

if (!run(['docker', 'info', '--format', '{{.ServerVersion}}']).isSuccess) {
  console.error('Docker is not running: start it, then run this again')
  process.exit(1)
}

const container = `strategydance-races-${randomUUID().slice(0, 8)}`
const postgresPort = findFreePort(FIRST_POSTGRES_PORT)
const emulatorPorts: number[] = []

for (let index = 0; index < EMULATOR_COUNT; index++) {
  emulatorPorts.push(findFreePort(FIRST_EMULATOR_PORT, emulatorPorts))
}

const proxyPort = findFreePort(FIRST_PROXY_PORT)
const directory = await mkdtemp(join(tmpdir(), 'strategydance-races-'))

const emulators: Bun.Subprocess[] = []
let proxy: Bun.Server<undefined> | null = null
let isTornDown = false

async function tearDown() {
  if (isTornDown) return

  isTornDown = true

  void proxy?.stop(true)

  await Promise.all(
    emulators.map(async emulator => {
      emulator.kill('SIGINT')

      if ((await Promise.race([emulator.exited, wait(10_000).then(() => 'timeout')])) === 'timeout') {
        emulator.kill('SIGKILL')
      }
    }),
  )

  run(['docker', 'rm', '-f', container])
  await rm(directory, { recursive: true, force: true })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void tearDown().finally(() => process.exit(130))
  })
}

async function startPostgres(database: string) {
  const started = run([
    'docker',
    'run',
    '--rm',
    '-d',
    '--name',
    container,
    '-p',
    `127.0.0.1:${postgresPort}:5432`,
    '-e',
    `POSTGRES_PASSWORD=${PASSWORD}`,
    '-e',
    `POSTGRES_DB=${database}`,
    POSTGRES_IMAGE,
    '-c',
    'log_lock_waits=on',
    '-c',
    'deadlock_timeout=1ms',
  ])

  if (!started.isSuccess) throw new Error(`Postgres did not start: ${started.stderr}`)

  // Over TCP, which the image's entrypoint only listens on once it has initialized the database
  for (let attempt = 0; attempt < 120; attempt++) {
    if (
      run(['docker', 'exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', database]).isSuccess
    ) {
      return
    }

    await wait(500)
  }

  throw new Error('Postgres did not accept connections within a minute')
}

function logPath(port: number) {
  return join(directory, `dataconnect-${port}.log`)
}

async function readLogTail(port: number) {
  const path = logPath(port)

  return existsSync(path) ? (await readFile(path, 'utf8')).split('\n').slice(-30).join('\n') : ''
}

// Starts the binary as the CLI does, writing nothing into the checkout
function startEmulator(binary: string, port: number) {
  const emulator = Bun.spawn(
    [
      binary,
      '--logtostderr',
      '-v=2',
      'dev',
      `--listen=127.0.0.1:${port}`,
      `--config_dir=${databasePackage}`,
      '--enable_output_generated_sdk=false',
      '--enable_output_schema_extensions=false',
    ],
    // It logs to stderr alone
    { cwd: directory, stdout: 'ignore', stderr: Bun.file(logPath(port)) },
  )

  emulators.push(emulator)

  return emulator
}

// Hands an emulator the database once it listens, which is once it has compiled the schema and
// connectors, as the CLI does. Configuring migrates the schema into the database, which the first
// emulator does and the others find done
async function configureEmulator(
  emulator: Bun.Subprocess,
  port: number,
  service: { serviceId: string; database: string },
) {
  const deadline = Date.now() + EMULATOR_START_TIMEOUT_MS
  const body = JSON.stringify({
    connectionString: `postgres://postgres:${PASSWORD}@127.0.0.1:${postgresPort}/${service.database}?sslmode=disable`,
    ...service,
  })

  while (Date.now() < deadline) {
    if (emulator.exitCode !== null) throw new Error(`The emulator on ${port} exited:\n${await readLogTail(port)}`)

    // A connection refused until it listens, which a loaded machine delays
    const response = await fetch(`http://127.0.0.1:${port}/emulator/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => null)

    if (response?.ok) return

    if (response) {
      throw new Error(`The emulator on ${port} refused its database (${response.status}): ${await response.text()}`)
    }

    await wait(500)
  }

  throw new Error(
    `The emulator on ${port} did not listen within ${EMULATOR_START_TIMEOUT_MS / 1000} s:\n${await readLogTail(port)}`,
  )
}

// Hands each request to the next emulator in turn, so writers released at once reach different ones
function startProxy() {
  let next = 0

  proxy = Bun.serve({
    hostname: '127.0.0.1',
    port: proxyPort,
    async fetch(request) {
      const url = new URL(request.url)

      url.host = `127.0.0.1:${emulatorPorts[next++ % emulatorPorts.length]}`

      return fetch(url, { method: request.method, headers: request.headers, body: await request.arrayBuffer() })
    },
  })
}

function readPostgres(database: string, query: string) {
  return run(['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', database, '-tAc', query]).stdout
}

let exitCode = 0

try {
  const service = await readService()

  await startPostgres(service.database)

  const binary = await findEmulatorBinary()
  // Started at once, so they compile side by side, then configured one after the other, so only the
  // first migrates
  const started = emulatorPorts.map(port => ({ port, emulator: startEmulator(binary, port) }))

  for (const { port, emulator } of started) await configureEmulator(emulator, port, service)

  if (readPostgres(service.database, "select count(*) from pg_tables where tablename = 'conversation_run'") !== '1') {
    throw new Error(`The emulators did not migrate the schema into Postgres:\n${await readLogTail(emulatorPorts[0]!)}`)
  }

  startProxy()

  const environment = {
    DATA_CONNECT_EMULATOR_HOST: `127.0.0.1:${proxyPort}`,
    RACES_POSTGRES_CONTAINER: container,
  }

  console.error(
    `Data Connect on 127.0.0.1:${proxyPort}, ${EMULATOR_COUNT} emulators on Postgres ${readPostgres(service.database, 'show server_version')} in ${container}`,
  )

  if (command.length === 0) {
    console.error(
      `Point a check at it with ${Object.entries(environment)
        .map(([name, value]) => `${name}=${value}`)
        .join(' ')}, and stop it with Ctrl-C`,
    )
    await new Promise(() => {})
  }

  const child = Bun.spawn(command, {
    env: { ...process.env, ...environment },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  exitCode = await child.exited
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  await tearDown()
}

process.exit(exitCode)
