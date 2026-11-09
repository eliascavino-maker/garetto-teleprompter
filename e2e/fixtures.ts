import type { BrowserContext } from '@playwright/test'
import JSZip from 'jszip'

/** Arranca con la guía de primeros pasos cerrada, para que no tape la letra. */
export function sinGuia(context: BrowserContext) {
  return context.addInitScript(() => localStorage.setItem('garetto-teleprompter:guia', JSON.stringify({ dismissed: true })))
}

/**
 * En Playwright una ventana emergente cree que el monitor mide lo mismo que
 * ella, y parece estar con F11. Se simula un monitor de 1920×1080.
 */
export function monitorGrande(context: BrowserContext) {
  return context.addInitScript(() => {
    Object.defineProperty(screen, 'width', { get: () => 1920 })
    Object.defineProperty(screen, 'height', { get: () => 1080 })
  })
}

/* Archivos de prueba armados en el momento: .txt, .docx y PDF. */

/** Un .txt guardado como Windows-1252 (Bloc de notas viejo). */
export function latin1Txt(text: string): Buffer {
  return Buffer.from(text, 'latin1')
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Un .docx mínimo: un párrafo por renglón; los renglones vacíos quedan como párrafos vacíos. */
export async function docx(lines: string[]): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  const body = lines.map((l) => (l ? `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>` : '<w:p/>')).join('')
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

/** Un PDF de una página. null deja un hueco (cambio de parte). Solo ASCII. */
export function pdf(lines: Array<string | null>): Buffer {
  let y = 740
  const ops: string[] = []
  for (const l of lines) {
    if (l === null) {
      y -= 22
      continue
    }
    ops.push(`BT /F1 16 Tf 72 ${y} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`)
    y -= 22
  }
  const stream = ops.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
