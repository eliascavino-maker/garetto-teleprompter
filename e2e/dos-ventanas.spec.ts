import { expect, test, type Page } from '@playwright/test'
import { sinGuia } from './fixtures.ts'

test.beforeEach(({ context }) => sinGuia(context))

const SHOTS = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (!SHOTS) return
  await page.waitForTimeout(400) // que terminen las animaciones de entrada
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

/** Agrega directo en IndexedDB una copia del tema de ejemplo como segundo tema del setlist. */
async function seedSecondSong(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('garetto-teleprompter')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['songs', 'setlists'], 'readwrite')
          const songs = tx.objectStore('songs')
          const setlists = tx.objectStore('setlists')
          songs.getAll().onsuccess = (e) => {
            const [first] = (e.target as IDBRequest).result
            const second = { ...first, id: 'segundo', title: 'Segundo tema' }
            songs.put(second)
            setlists.getAll().onsuccess = (ev) => {
              const [sl] = (ev.target as IDBRequest).result
              setlists.put({ ...sl, items: [...sl.items, { type: 'song', songId: 'segundo' }] })
            }
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

test('la consola maneja la pantalla de Gabi', async ({ page, context }) => {
  await page.goto('./')

  // Arranca vacía: carga el ejemplo.
  await expect(page.getByText('Todavía no hay ningún setlist.')).toBeVisible()
  await page.getByRole('button', { name: 'Cargar un ejemplo para probar' }).click()
  await expect(page.getByRole('heading', { name: 'Mandale baile (ejemplo)' })).toBeVisible()

  // Abrir la ventana de Gabi.
  const [gabi] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Abrir pantalla de Gabi' }).click()])
  await gabi.setViewportSize({ width: 1920, height: 1080 })
  await expect(page.getByText('Pantalla conectada')).toBeVisible()
  await expect(gabi.locator('.g-solo b')).toHaveText('Intro')

  // → avanza una línea.
  await page.keyboard.press('ArrowRight')
  await expect(gabi.locator('.g-now')).toHaveText('Llegamos de lejos con ganas de fiesta')

  // Shift → salta al coro, con su ×2.
  await page.keyboard.press('Shift+ArrowRight')
  await expect(gabi.locator('.g-part')).toContainText('Coro')
  await expect(gabi.locator('.g-cue')).toContainText('×2')

  // M: modo parte con la línea marcada.
  await page.keyboard.press('m')
  await expect(gabi.locator('.g-parte p')).toHaveCount(4)
  await shot(page, 'consola')

  // Recargar la consola en pleno show: vuelve al coro y la pantalla sigue conectada.
  await seedSecondSong(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Mandale baile (ejemplo)' })).toBeVisible()
  await expect(gabi.locator('.g-part')).toContainText('Coro')
  await expect(page.getByText('Pantalla conectada')).toBeVisible()
  await expect(page.getByText('2 temas')).toBeVisible()

  // Al final del tema, → pasa al siguiente.
  await page.getByRole('button', { name: /nos vemos en la próxima/ }).click()
  await expect(gabi.locator('.g-now')).toHaveText('nos vemos en la próxima')
  await expect(gabi.locator('.g-foot')).toContainText('Segundo tema')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Segundo tema' })).toBeVisible()
  await expect(gabi.locator('.g-solo b')).toHaveText('Intro')

  // ← desde el comienzo vuelve al final del anterior.
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('heading', { name: 'Mandale baile (ejemplo)' })).toBeVisible()
  await expect(gabi.locator('.g-now')).toHaveText('nos vemos en la próxima')

  // Mensaje rápido (F2), mensaje libre (F6), NEGRO y LOGO.
  await page.keyboard.press('F2')
  await expect(gabi.locator('.g-cartel')).toContainText('Más lento')
  await page.keyboard.press('Escape')
  await page.keyboard.press('F6')
  await page.keyboard.type('Saludá a Alberdi')
  await page.keyboard.press('Enter')
  await expect(gabi.locator('.g-cartel')).toContainText('Saludá a Alberdi')
  await shot(gabi, 'gabi-mensaje-libre')
  await page.keyboard.press('Escape')
  await page.keyboard.press('b')
  await expect(gabi.locator('.g-negro')).toBeVisible()
  await page.keyboard.press('b')
  await page.keyboard.press('l')
  await expect(gabi.locator('.g-over .g-espera')).toBeVisible()
  await page.keyboard.press('l')

  // Enganchar los dos temas: aparece la costura.
  await page.locator('.sl-row').first().hover()
  await page.getByRole('button', { name: 'Enganchar con el siguiente' }).first().click()
  await expect(page.locator('.eng .sl-row')).toHaveCount(2)
  await expect(page.locator('.eng-h')).toContainText('Enganchado')
  await shot(page, 'consola-enganchado')

  // Al cerrar la ventana, la consola se entera.
  await gabi.close()
  await expect(page.getByRole('button', { name: 'Abrir pantalla de Gabi' })).toBeVisible()
})
