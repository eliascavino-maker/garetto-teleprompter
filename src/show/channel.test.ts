import { afterEach, describe, expect, it } from 'vitest'
import { ConsoleLink, GabiLink } from './channel'
import type { ShowState } from './view'

// Node trae BroadcastChannel: estos tests usan el canal real.

const state = (seq: number, title = 'Tema'): ShowState => ({
  seq,
  title,
  lyric: null,
  overlay: null,
  style: 'a',
  device: { rotation: 0, mirror: false, marginPct: 0 },
})

async function until(check: () => boolean, ms = 2000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('No pasó a tiempo')
    await new Promise((r) => setTimeout(r, 10))
  }
}

const open: Array<{ close(): void }> = []
afterEach(() => {
  while (open.length) open.pop()!.close()
})

function pair(name: string, timeoutMs = 300, heartbeatMs = 50) {
  const consola = new ConsoleLink({ name, timeoutMs })
  open.push(consola)
  const gabi = () => {
    const g = new GabiLink({ name, heartbeatMs })
    open.push(g)
    return g
  }
  return { consola, gabi }
}

describe('canal consola ↔ Gabi', () => {
  it('una pantalla recién abierta recibe el último estado', async () => {
    const { consola, gabi } = pair('t1')
    consola.publish(state(1, 'Primero'))
    consola.publish(state(2, 'Segundo'))

    const g = gabi()
    const received: ShowState[] = []
    g.onState((s) => received.push(s))
    await until(() => received.length > 0)
    expect(received.at(-1)?.title).toBe('Segundo')
  })

  it('los cambios llegan en vivo y se ignoran los estados viejos', async () => {
    const { consola, gabi } = pair('t2')
    const g = gabi()
    const titles: string[] = []
    g.onState((s) => titles.push(s.title ?? ''))
    await until(() => consola.connected)

    consola.publish(state(10, 'A'))
    consola.publish(state(9, 'viejo'))
    consola.publish(state(11, 'B'))
    await until(() => titles.includes('B'))
    expect(titles).toEqual(['A', 'B'])
  })

  it('la consola sabe si la pantalla está conectada', async () => {
    const { consola, gabi } = pair('t3')
    const status: boolean[] = []
    consola.onStatus((c) => status.push(c))
    expect(consola.connected).toBe(false)

    const g = gabi()
    await until(() => consola.connected)

    // Al cerrar la ventana avisa "bye" y se desconecta enseguida.
    g.close()
    await until(() => !consola.connected)
    expect(status).toEqual([true, false])
  })

  it('si la pantalla deja de latir, se da por desconectada', async () => {
    // Saluda al abrir y después no late más, como una ventana colgada.
    const { consola, gabi } = pair('t4', 200, 60_000)
    gabi()
    await until(() => consola.connected)
    await until(() => !consola.connected, 1000)
  })
})
