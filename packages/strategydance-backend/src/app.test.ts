import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// No route here reaches Firebase: what is checked is which routes each service mounts
mock.module('~firebase', () => ({ authentication: {}, appCheck: {}, dataConnect: {}, bucket: {} }))

const { default: createApp } = await import('./app')

let server: Server
let origin: string

beforeAll(async () => {
  server = createApp().listen(0)

  await new Promise(resolve => server.once('listening', resolve))

  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

describe('createApp', () => {
  test('answers its health check', async () => {
    const response = await fetch(`${origin}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'success' })
  })

  test('answers 404 where no route is', async () => {
    const response = await fetch(`${origin}/nowhere`, { method: 'POST' })

    expect(response.status).toBe(404)
  })
})
