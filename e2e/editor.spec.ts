import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { docx, latin1Txt, pdf } from './fixtures.ts'

const SHOTS = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (!SHOTS) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

const LETRA = `Fuego en Alberdi

Llegamos de lejos con ganas de fiesta
la barra ya canta y el baile se presta

Mandale baile
que la noche es larga

Prendimos la radio, salimos al centro
la noche de Córdoba nos lleva adentro

Mandale baile
que la noche es larga`

/** Pone el cursor del textarea en el renglón que contiene ese texto. */
async function caretAt(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Letra' }).evaluate((ta: HTMLTextAreaElement, t) => {
    const i = ta.value.indexOf(t) + 2
    ta.focus()
    ta.setSelectionRange(i, i)
  }, text)
}

test('editor: escribir, marcar, deshacer, importar y backup', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Cargar canciones' }).click()
  const lib = page.getByRole('dialog', { name: 'Canciones' })
  await expect(lib.getByText('Todavía no hay canciones.')).toBeVisible()

  /* ---------- Tema nuevo, pegando la letra con el título arriba ---------- */
  await lib.getByRole('button', { name: 'Nuevo tema' }).first().click()
  await expect(lib.getByText('Poné un título para guardar')).toBeVisible()
  await lib.getByRole('textbox', { name: 'Letra' }).fill(LETRA)
  await lib.getByRole('button', { name: 'Usarlo' }).click()
  await expect(lib.getByRole('textbox', { name: 'Título' })).toHaveValue('Fuego en Alberdi')
  await expect(lib.getByRole('textbox', { name: 'Letra' })).not.toHaveValue(/^Fuego/)

  // El coro repetido se detecta solo.
  const prev = lib.getByRole('region', { name: 'Cómo queda' })
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Estrofa 1', 'Coro', 'Estrofa 2', 'Coro'])
  await expect(lib.getByText('Guardado')).toBeVisible()
  await expect(lib.locator('.lib-song__t')).toHaveText(['Fuego en Alberdi'])

  /* ---------- Indicación en la línea y deshacer ---------- */
  await caretAt(page, 'que la noche es larga')
  await lib.getByRole('button', { name: 'Corte' }).click()
  await expect(lib.getByRole('textbox', { name: 'Letra' })).toHaveValue(/que la noche es larga \(corte\)/)
  await expect(lib.getByRole('button', { name: 'Corte' })).toHaveAttribute('aria-pressed', 'true')
  await expect(prev.locator('.cue').first()).toContainText('Corte')

  // Marcar la segunda estrofa como puente.
  await caretAt(page, 'Prendimos la radio')
  await lib.getByRole('button', { name: 'Puente' }).click()
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Estrofa 1', 'Coro', 'Puente', 'Coro'])

  await page.keyboard.press('Control+z')
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Estrofa 1', 'Coro', 'Estrofa 2', 'Coro'])
  await page.keyboard.press('Control+y')
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Estrofa 1', 'Coro', 'Puente', 'Coro'])

  await lib.getByRole('textbox', { name: 'Duración' }).fill('4:1')
  await expect(lib.getByText('Revisá la duración')).toBeVisible()
  await lib.getByRole('textbox', { name: 'Duración' }).fill('4:10')
  await expect(lib.getByText('Guardado')).toBeVisible()
  await shot(page, 'editor')

  /* ---------- Importar .txt (Windows-1252), .docx y PDF ---------- */
  await lib.locator('input[type=file][multiple]').setInputFiles([
    { name: '01 - Corazón de cuarteto.txt', mimeType: 'text/plain', buffer: latin1Txt('[Coro]\nCorazón de cuarteto\nlate en la ciudad\n\n[Estrofa]\nSalimos a bailar') },
    { name: 'La noche (letra).docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await docx(['La noche', '', 'Primera de la noche', 'segunda de la noche', '', 'Coro de la noche (x2)']) },
    { name: 'Del PDF.pdf', mimeType: 'application/pdf', buffer: pdf(['Primera del pdf', 'segunda del pdf', null, 'Tercera del pdf']) },
    { name: 'viejo.doc', mimeType: 'application/msword', buffer: Buffer.from('x') },
  ])
  await expect(page.getByRole('status').filter({ hasText: 'Se importaron 3 temas.' })).toContainText('.doc viejo')
  await expect(lib.locator('.lib-song__t')).toHaveText(['Corazón de cuarteto', 'Del PDF', 'Fuego en Alberdi', 'La noche'])

  await lib.getByRole('button', { name: /Corazón de cuarteto/ }).click()
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Coro', 'Estrofa 1'])
  await expect(prev).toContainText('Corazón de cuarteto')

  // El título repetido arriba de la letra del .docx se saca.
  await lib.getByRole('button', { name: /La noche/ }).click()
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Estrofa 1', 'Estrofa 2'])
  await expect(prev.locator('.cue')).toContainText('×2')

  await lib.getByRole('button', { name: /Del PDF/ }).click()
  await expect(prev.locator('.ed-part__h b')).toHaveText(['Estrofa 1', 'Estrofa 2'])
  await expect(prev.locator('li')).toHaveText(['Primera del pdf', 'segunda del pdf', 'Tercera del pdf'])

  /* ---------- Borrar y deshacer ---------- */
  await lib.getByRole('button', { name: 'Borrar el tema' }).click()
  await expect(lib.locator('.lib-song__t')).toHaveCount(3)
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(lib.locator('.lib-song__t')).toHaveCount(4)

  /* ---------- Backup: bajar, cambiar algo y restaurar ---------- */
  const [download] = await Promise.all([page.waitForEvent('download'), lib.getByRole('button', { name: 'Bajar backup' }).click()])
  expect(download.suggestedFilename()).toMatch(/^garetto-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.songs).toHaveLength(4)
  await expect(lib.getByText('Último backup: hoy')).toBeVisible()

  await lib.getByRole('button', { name: /Fuego en Alberdi/ }).click()
  await lib.getByRole('textbox', { name: 'Título' }).fill('Fuego cambiado')
  await expect(lib.getByText('Guardado')).toBeVisible()

  await lib.locator('input[type=file]:not([multiple])').setInputFiles(backupPath)
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('4 temas')
  await confirm.getByRole('button', { name: 'Restaurar' }).click()
  await expect(lib.locator('.lib-song__t')).toContainText(['Fuego en Alberdi'])
  // Deshacer la restauración vuelve al título cambiado.
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(lib.locator('.lib-song__t')).toContainText(['Fuego cambiado'])

  /* ---------- De vuelta en la consola ---------- */
  await page.keyboard.press('Escape')
  await expect(lib).toBeHidden()
  await page.getByRole('button', { name: 'Nuevo setlist' }).first().click()
  await page.keyboard.press('/')
  await page.keyboard.type('fuego')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Fuego cambiado' })).toBeVisible()
  await expect(page.locator('.ly-part__h')).toHaveCount(4)

  // Editar desde la letra abre ese tema.
  await page.getByRole('button', { name: 'Editar este tema' }).click()
  await expect(lib.getByRole('textbox', { name: 'Título' })).toHaveValue('Fuego cambiado')
  await expect(lib.getByRole('button', { name: 'Está en el setlist' })).toBeDisabled()
  await page.keyboard.press('Escape')

  // Sacar del setlist y deshacer con Ctrl+Z.
  await page.locator('.sl-row').first().hover()
  await page.getByRole('button', { name: 'Sacar del setlist' }).click()
  await expect(page.locator('.sl-row')).toHaveCount(0)
  await page.locator('body').click({ position: { x: 700, y: 400 } })
  await page.keyboard.press('Control+z')
  await expect(page.locator('.sl-row')).toHaveCount(1)
})
