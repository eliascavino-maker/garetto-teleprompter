import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (!SHOTS) return
  await page.waitForTimeout(400) // que terminen las animaciones de entrada
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

test('la consola maneja la pantalla de Gabi', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByText('Pantalla cerrada')).toBeVisible()

  // Abrir la ventana de Gabi.
  const [gabi] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Abrir pantalla de Gabi' }).click()])
  await gabi.setViewportSize({ width: 1920, height: 1080 })
  await expect(page.getByText('Pantalla conectada')).toBeVisible()

  // Arranca en la intro instrumental.
  await expect(gabi.locator('.g-solo b')).toHaveText('Intro')
  await shot(gabi, 'gabi-1-intro')

  // → avanza una línea.
  await page.keyboard.press('ArrowRight')
  await expect(gabi.locator('.g-now')).toHaveText('Llegamos de lejos con ganas de fiesta')
  await expect(gabi.locator('.g-next').first()).toHaveText('la noche recién empieza en Córdoba')
  await shot(gabi, 'gabi-2-linea')

  // Shift → salta a la parte siguiente (el coro), con su indicación ×2.
  await page.keyboard.press('Shift+ArrowRight')
  await expect(gabi.locator('.g-part')).toContainText('Coro')
  await expect(gabi.locator('.g-now')).toHaveText('Mandale baile, mandale baile')
  await expect(gabi.locator('.g-cue')).toContainText('×2')
  await shot(gabi, 'gabi-3-coro')

  // M pasa a modo parte: el coro entero en pantalla, con la línea marcada.
  await page.keyboard.press('m')
  await expect(gabi.locator('.g-parte p')).toHaveCount(4)
  await expect(gabi.locator('.g-parte p.g-now')).toContainText('Mandale baile, mandale baile')
  await shot(gabi, 'gabi-4-parte')

  // El final tiene 10 líneas: se divide en dos pantallas.
  await page.getByRole('switch', { name: 'Marcar la línea' }).click()
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight')
  await expect(gabi.locator('.g-part')).toContainText('Final')
  await expect(gabi.locator('.g-page')).toHaveText('1/2')
  await page.keyboard.press('ArrowRight')
  await expect(gabi.locator('.g-page')).toHaveText('2/2')
  await shot(gabi, 'gabi-5-final-2de2')

  // Estilo C.
  await page.getByRole('radio', { name: 'Estilo C' }).click()
  await page.getByRole('radio', { name: 'Línea' }).click()
  await expect(gabi.locator('.gabi--c .g-now')).toBeVisible()
  await shot(gabi, 'gabi-6-estilo-c')

  // Mensaje rápido (F2) y NEGRO (B).
  await page.keyboard.press('F2')
  await expect(gabi.locator('.g-cartel')).toContainText('Más lento')
  await shot(gabi, 'gabi-7-mensaje')
  await page.keyboard.press('Escape')
  await expect(gabi.locator('.g-cartel')).toHaveCount(0)
  await page.keyboard.press('b')
  await expect(gabi.locator('.g-negro')).toBeVisible()
  await page.keyboard.press('b')
  await expect(gabi.locator('.g-negro')).toHaveCount(0)

  // LOGO.
  await page.keyboard.press('l')
  await expect(gabi.locator('.g-over .g-espera')).toBeVisible()
  await shot(gabi, 'gabi-8-logo')
  await page.keyboard.press('l')

  await shot(page, 'consola')

  // Si la ventana se recarga, recupera el estado sola.
  await gabi.reload()
  await expect(gabi.locator('.gabi--c .g-now')).toBeVisible()

  // Al cerrar la ventana, la consola se entera.
  await gabi.close()
  await expect(page.getByText('Pantalla cerrada')).toBeVisible()
})
