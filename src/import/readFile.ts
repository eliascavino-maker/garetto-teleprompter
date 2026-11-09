import { decodeText, textFromDocxHtml, textFromPdfPages, titleFromFileName, type PdfItem } from './text'

export interface ImportedText {
  title: string
  text: string
}

/** Extensiones que se pueden importar como letra. */
export const LYRICS_ACCEPT = '.txt,.text,.docx,.pdf'

/** Error con un mensaje que se puede mostrar tal cual. */
export class ImportError extends Error {}

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''

/** Lee un archivo de letra (.txt, .docx o PDF) y devuelve el título y el texto. */
export async function readLyricsFile(file: File): Promise<ImportedText> {
  const ext = extOf(file.name)
  const title = titleFromFileName(file.name)
  let text: string
  if (ext === 'txt' || ext === 'text' || file.type === 'text/plain') text = decodeText(await file.arrayBuffer())
  else if (ext === 'docx') text = await readDocx(file)
  else if (ext === 'pdf') text = await readPdf(file)
  else if (ext === 'doc') throw new ImportError(`“${file.name}” es un .doc viejo: abrilo en Word y guardalo como .docx.`)
  else throw new ImportError(`“${file.name}” no se puede importar: tiene que ser .txt, .docx o PDF.`)

  if (!text.trim()) {
    throw new ImportError(
      ext === 'pdf'
        ? `“${file.name}” no tiene texto: parece una foto escaneada. Hay que pasar la letra a mano.`
        : `“${file.name}” está vacío.`,
    )
  }
  return { title, text }
}

async function readDocx(file: File): Promise<string> {
  const { default: mammoth } = await import('mammoth')
  try {
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { ignoreEmptyParagraphs: false })
    return textFromDocxHtml(value)
  } catch {
    throw new ImportError(`No se pudo leer “${file.name}”: el .docx parece dañado.`)
  }
}

async function readPdf(file: File): Promise<string> {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let doc
  try {
    doc = await task.promise
  } catch (e) {
    void task.destroy()
    const locked = e instanceof Error && e.name === 'PasswordException'
    throw new ImportError(locked ? `“${file.name}” tiene contraseña.` : `No se pudo leer “${file.name}”: el PDF parece dañado.`)
  }
  try {
    const pages: PdfItem[][] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      pages.push(
        content.items.flatMap((it) =>
          'str' in it ? [{ str: it.str, y: it.transform[5], height: it.height || Math.abs(it.transform[3]), hasEOL: it.hasEOL }] : [],
        ),
      )
    }
    return textFromPdfPages(pages)
  } finally {
    void task.destroy()
  }
}
