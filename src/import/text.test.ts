import { describe, expect, it } from 'vitest'
import { analyzeLyrics } from '../data/parser'
import { decodeText, textFromDocxHtml, textFromPdfPages, titleFromFileName, type PdfItem } from './text'

describe('titleFromFileName', () => {
  it('saca extensión, número de pista y "letra"', () => {
    expect(titleFromFileName('01 - Mandale_baile (letra).docx')).toBe('Mandale baile')
    expect(titleFromFileName('3. Fuego en Alberdi.pdf')).toBe('Fuego en Alberdi')
    expect(titleFromFileName('La noche - letra.txt')).toBe('La noche')
    expect(titleFromFileName('500 millas.txt')).toBe('500 millas')
    expect(titleFromFileName('.txt')).toBe('Sin título')
  })
})

describe('decodeText', () => {
  it('lee UTF-8 y, si no es válido, Windows-1252', () => {
    expect(decodeText(new TextEncoder().encode('Corazón').buffer)).toBe('Corazón')
    // "Corazón" guardado con el Bloc de notas viejo: la ó es 0xF3.
    const latin = new Uint8Array([0x43, 0x6f, 0x72, 0x61, 0x7a, 0xf3, 0x6e])
    expect(decodeText(latin.buffer)).toBe('Corazón')
  })
})

describe('textFromDocxHtml', () => {
  it('un párrafo por renglón y los vacíos separan partes', () => {
    const html = '<h1>Coro</h1><p>Mandale <strong>baile</strong></p><p>que la noche<br />es larga</p><p></p><p>Tom &amp; Jerry &#233;</p>'
    expect(textFromDocxHtml(html)).toBe('Coro\nMandale baile\nque la noche\nes larga\n\nTom & Jerry é')
  })
})

describe('textFromPdfPages', () => {
  const at = (str: string, y: number, hasEOL = true): PdfItem => ({ str, y, height: 12, hasEOL })

  it('arma renglones, detecta los huecos grandes y saca números de página', () => {
    const page1 = [
      at('Llegamos ', 700, false),
      at('de lejos', 700),
      at('con ganas de fiesta', 684),
      at('Mandale baile', 650),
      at('que la noche es larga', 634),
      at('1', 40),
    ]
    const page2 = [at('Final', 700), at('Página 2 de 2', 40)]
    const text = textFromPdfPages([page1, page2])
    expect(text).toBe('Llegamos de lejos\ncon ganas de fiesta\n\nMandale baile\nque la noche es larga\n\nFinal')
    expect(analyzeLyrics(text).sections).toHaveLength(3)
  })

  it('detecta el hueco aunque haya pocas líneas', () => {
    expect(textFromPdfPages([[at('Uno', 740), at('Dos', 718), at('Tres', 674)]])).toBe('Uno\nDos\n\nTres')
  })

  it('un PDF sin texto da texto vacío', () => {
    expect(textFromPdfPages([[], [{ str: '', y: 0, height: 0, hasEOL: true }]])).toBe('')
  })
})
