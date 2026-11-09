import { expect, test } from '@playwright/test'
import { PREVIEW_URL } from '../playwright.config.ts'
import { docx, monitorGrande, sinGuia } from './fixtures.ts'

const SHOTS = process.env.SHOTS_DIR

test.beforeEach(async ({ context }) => {
  await sinGuia(context)
  await monitorGrande(context)
})

test('sin internet: la consola, la pantalla de Gabi y la importación siguen andando', async ({ page, context }) => {
  // Primera visita con internet: se instala el service worker y guarda todo.
  await page.goto(PREVIEW_URL)
  await expect(page.getByText('Listo: la app ya funciona sin internet.')).toBeVisible({ timeout: 20_000 })

  // Sin internet y recargando: la app sale del caché.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Sin internet')).toBeVisible()
  await page.getByRole('button', { name: 'Cargar un ejemplo para probar' }).click()
  await expect(page.getByRole('heading', { name: 'Mandale baile (ejemplo)' })).toBeVisible()

  // La ventana de Gabi también abre sin internet, y le cuenta a la consola cómo está.
  const [gabi] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Abrir pantalla de Gabi' }).click()])
  await expect(gabi.locator('.g-solo b')).toHaveText('Intro')
  await expect(page.getByText('Pantalla conectada · falta pantalla completa')).toBeVisible()
  await expect(gabi.getByText('Hacé clic acá para pantalla completa')).toBeVisible()
  if (SHOTS) await gabi.screenshot({ path: `${SHOTS}/gabi-aviso.png` })
  await page.keyboard.press('ArrowRight')
  await expect(gabi.locator('.g-now')).toHaveText('Llegamos de lejos con ganas de fiesta')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/consola-offline.png` })

  // mammoth se carga recién al importar: tiene que salir del caché.
  await page.getByRole('button', { name: 'Canciones' }).click()
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'Sin internet.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await docx(['Primera sin internet', 'segunda sin internet']),
  })
  await expect(page.getByText('Se importó “Sin internet”.')).toBeVisible()
  await gabi.close()
})
