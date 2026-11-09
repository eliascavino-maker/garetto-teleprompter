import { describe, expect, it } from 'vitest'
import { pickExternal, type ScreenArea } from './screens'

const screen = (label: string, isInternal: boolean): ScreenArea => ({
  label,
  isInternal,
  isPrimary: isInternal,
  availLeft: 0,
  availTop: 0,
  availWidth: 1920,
  availHeight: 1080,
})

describe('pickExternal', () => {
  const notebook = screen('Notebook', true)
  const monitor = screen('Monitor de piso', false)
  const otro = screen('Otro interno', true)

  it('elige el monitor externo, no la notebook', () => {
    expect(pickExternal([notebook, monitor], notebook)).toBe(monitor)
    expect(pickExternal([otro, notebook, monitor], notebook)).toBe(monitor)
  })

  it('si la consola está en el externo, usa el otro', () => {
    expect(pickExternal([notebook, monitor], monitor)).toBe(notebook)
  })

  it('con un solo monitor no hay adónde mandarla', () => {
    expect(pickExternal([notebook], notebook)).toBeNull()
  })
})
