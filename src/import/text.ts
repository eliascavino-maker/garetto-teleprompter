/*
 * Piezas puras de la importación: sacar el texto de cada formato y armar el
 * título desde el nombre del archivo. Lo pesado (mammoth y pdf.js) vive en
 * readFile.ts y se carga solo al importar.
 */

/** "01 - Mandale_baile (letra).docx" → "Mandale baile" */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{1,5}$/i, '')
  const clean = base
    .replace(/[_]+/g, ' ')
    .replace(/^\s*\d{1,3}\s*[-.)_]\s*/, '') // número de pista
    .replace(/[\s-]*[([]?\s*(letra|lyrics|acordes)\s*[)\]]?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || base.trim() || 'Sin título'
}

/**
 * Texto de un .txt. Si no es UTF-8 válido, se lee como Windows-1252: así
 * vienen muchos .txt viejos guardados con el Bloc de notas.
 */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/* ---------- .docx ---------- */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[e.toLowerCase()] ?? whole
  })
}

/**
 * Texto del HTML que arma mammoth: cada párrafo es un renglón, los párrafos
 * vacíos separan partes y los saltos de línea (Mayús+Enter) se respetan.
 */
export function textFromDocxHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ---------- PDF ---------- */

/** Lo que importa de cada pedazo de texto de pdf.js. */
export interface PdfItem {
  str: string
  /** Posición vertical (de abajo hacia arriba, como en el PDF). */
  y: number
  height: number
  hasEOL: boolean
}

interface PdfLine {
  text: string
  y: number
}

const PAGE_NUMBER = /^(p[áa]g(ina)?\.?\s*)?\d{1,3}(\s*(de|\/)\s*\d{1,3})?$/i

function linesOf(items: PdfItem[]): PdfLine[] {
  const lines: PdfLine[] = []
  let current: PdfLine | null = null
  const finish = () => {
    if (current && current.text.trim()) lines.push({ text: current.text.replace(/\s+/g, ' ').trim(), y: current.y })
    current = null
  }
  for (const it of items) {
    if (it.str) {
      const tolerance = Math.max(2, it.height * 0.4)
      if (current && Math.abs(current.y - it.y) > tolerance) finish()
      if (current) current.text += it.str
      else current = { text: it.str, y: it.y }
    }
    if (it.hasEOL) finish()
  }
  finish()
  return lines.filter((l) => !PAGE_NUMBER.test(l.text))
}

/**
 * Arma el texto de un PDF página por página. Un salto vertical bastante más
 * grande que el interlineado normal se toma como línea en blanco (cambio de parte).
 */
export function textFromPdfPages(pages: PdfItem[][]): string {
  const out: string[] = []
  for (const items of pages) {
    const lines = linesOf(items)
    if (lines.length === 0) continue
    const gaps = lines
      .slice(1)
      .map((l, i) => lines[i].y - l.y)
      .filter((g) => g > 0)
      .sort((a, b) => a - b)
    // Interlineado normal: los saltos chicos son mayoría; con pocas líneas, la mediana falla.
    const normal = gaps.length ? gaps[Math.floor((gaps.length - 1) / 4)] : 0
    if (out.length) out.push('')
    lines.forEach((l, i) => {
      const gap = i > 0 ? lines[i - 1].y - l.y : 0
      if (i > 0 && normal > 0 && gap > normal * 1.5) out.push('')
      out.push(l.text)
    })
  }
  return out.join('\n')
}
