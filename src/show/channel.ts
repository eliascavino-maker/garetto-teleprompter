/*
 * Canal entre la consola y la pantalla de Gabi, en la misma notebook y sin
 * internet: BroadcastChannel.
 *
 *   consola → Gabi: { t: 'state' } con el estado completo en cada cambio.
 *   Gabi → consola: { t: 'hello' } al abrir (pide el estado),
 *                   { t: 'alive' } cada segundo, { t: 'bye' } al cerrar.
 *                   hello y alive llevan cómo está la pantalla (ScreenInfo).
 *
 * Se manda siempre el estado completo: si se pierde un mensaje, el siguiente
 * lo corrige, y una pantalla recién abierta queda al día con un solo envío.
 */
import type { ShowState } from './view'

export const CHANNEL_NAME = 'garetto-teleprompter-show'

export type ToGabi = { t: 'state'; state: ShowState }
/** Cómo está la ventana de Gabi: la consola lo muestra para que el operador sepa si falta algo. */
export interface ScreenInfo {
  /** Pantalla completa, con la API o con F11. */
  fullscreen: boolean
  width: number
  height: number
  /** true: la pantalla no se apaga. null: el navegador no tiene Wake Lock. */
  wakeLock: boolean | null
}

export type ToConsole = { t: 'hello'; info?: ScreenInfo } | { t: 'alive'; seq: number; info?: ScreenInfo } | { t: 'bye' }

export interface ConsoleLinkOptions {
  name?: string
  /** Sin latidos durante este tiempo, la pantalla se da por desconectada. */
  timeoutMs?: number
  now?: () => number
}

export class ConsoleLink {
  private readonly channel: BroadcastChannel
  private readonly timeoutMs: number
  private readonly now: () => number
  private readonly timer: ReturnType<typeof setInterval>
  private state: ShowState | null = null
  private lastAlive = Number.NEGATIVE_INFINITY
  private wasConnected = false
  private closed = false
  private listeners = new Set<(connected: boolean) => void>()
  private infoListeners = new Set<(info: ScreenInfo | null) => void>()
  private screen: ScreenInfo | null = null

  constructor({ name = CHANNEL_NAME, timeoutMs = 3000, now = Date.now }: ConsoleLinkOptions = {}) {
    this.channel = new BroadcastChannel(name)
    this.timeoutMs = timeoutMs
    this.now = now
    this.channel.onmessage = (e: MessageEvent<ToConsole>) => this.receive(e.data)
    this.timer = setInterval(() => this.check(), Math.max(50, timeoutMs / 3))
  }

  get connected(): boolean {
    return this.now() - this.lastAlive < this.timeoutMs
  }

  /** Avisa cuando la pantalla se conecta o se desconecta. Devuelve la función para dejar de escuchar. */
  onStatus(cb: (connected: boolean) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Cómo está la pantalla de Gabi (null si no está conectada). */
  get info(): ScreenInfo | null {
    return this.connected ? this.screen : null
  }

  onInfo(cb: (info: ScreenInfo | null) => void): () => void {
    this.infoListeners.add(cb)
    return () => this.infoListeners.delete(cb)
  }

  publish(state: ShowState) {
    this.state = state
    this.post({ t: 'state', state })
  }

  close() {
    if (this.closed) return
    this.closed = true
    clearInterval(this.timer)
    this.channel.close()
    this.listeners.clear()
    this.infoListeners.clear()
  }

  private receive(msg: ToConsole) {
    if (msg.t === 'bye') {
      this.lastAlive = Number.NEGATIVE_INFINITY
      this.setScreen(null)
    } else {
      this.lastAlive = this.now()
      if (msg.info) this.setScreen(msg.info)
      if (msg.t === 'hello' && this.state) this.post({ t: 'state', state: this.state })
    }
    this.check()
  }

  private check() {
    const c = this.connected
    if (c === this.wasConnected) return
    this.wasConnected = c
    for (const cb of this.listeners) cb(c)
    if (!c) this.setScreen(null)
  }

  private setScreen(info: ScreenInfo | null) {
    if (JSON.stringify(info) === JSON.stringify(this.screen)) return
    this.screen = info
    for (const cb of this.infoListeners) cb(info)
  }

  private post(msg: ToGabi) {
    this.channel.postMessage(msg)
  }
}

export interface GabiLinkOptions {
  name?: string
  heartbeatMs?: number
}

export class GabiLink {
  private readonly channel: BroadcastChannel
  private readonly timer: ReturnType<typeof setInterval>
  private seq = -1
  private closed = false
  private screen: ScreenInfo | undefined
  private listeners = new Set<(state: ShowState) => void>()

  constructor({ name = CHANNEL_NAME, heartbeatMs = 1000 }: GabiLinkOptions = {}) {
    this.channel = new BroadcastChannel(name)
    this.channel.onmessage = (e: MessageEvent<ToGabi>) => {
      const { state } = e.data
      // Si llegan desordenados, gana el más nuevo.
      if (e.data.t !== 'state' || state.seq <= this.seq) return
      this.seq = state.seq
      for (const cb of this.listeners) cb(state)
    }
    this.channel.postMessage({ t: 'hello' } satisfies ToConsole)
    this.timer = setInterval(() => this.alive(), heartbeatMs)
  }

  /** Actualiza cómo está la pantalla; si cambió, avisa enseguida. */
  setInfo(info: ScreenInfo) {
    if (JSON.stringify(info) === JSON.stringify(this.screen)) return
    this.screen = info
    if (!this.closed) this.alive()
  }

  private alive() {
    this.channel.postMessage({ t: 'alive', seq: this.seq, info: this.screen } satisfies ToConsole)
  }

  onState(cb: (state: ShowState) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  close() {
    if (this.closed) return
    this.closed = true
    clearInterval(this.timer)
    this.channel.postMessage({ t: 'bye' } satisfies ToConsole)
    this.channel.close()
    this.listeners.clear()
  }
}
