import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { DEV_URL } from '../playwright.config.ts'
import { monitorGrande } from './fixtures.ts'

/*
 * Revisión en los tamaños de pantalla de uso: notebook (1366×768), monitor
 * (1920×1080) y tablet. En cada uno: sin errores, sin scroll horizontal y
 * sin problemas graves de accesibilidad. Con SHOTS_DIR guarda capturas.
 */

const SHOTS = process.env.SHOTS_DIR

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-vertical-820x1180', width: 820, height: 1180 },
]

async function noHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }))
  expect(scroll, 'no tiene que haber scroll horizontal').toBeLessThanOrEqual(width)
}

/**
 * Problemas de accesibilidad graves o críticos. La vista previa de Gabi queda
 * afuera: la línea anterior casi invisible es una decisión de diseño.
 */
async function axe(page: Page, where: string) {
  // Que terminen los fundidos de entrada: a media animación el contraste da mal.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  )
  const { violations } = await new AxeBuilder({ page }).exclude('.con-preview').analyze()
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    serious.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`),
    'accesibilidad',
  ).toEqual([])
}

for (const vp of VIEWPORTS) {
  test(`revisión en ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, baseURL: DEV_URL })
    await monitorGrande(context)
    const page = await context.newPage()
    const errors: string[] = []
    const watch = (p: Page) => {
      p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`))
      p.on('console', (m) => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`))
    }
    watch(page)

    const shot = async (p: Page, name: string) => {
      if (!SHOTS) return
      await p.bringToFront()
      await p.waitForTimeout(450)
      await p.screenshot({ path: `${SHOTS}/${vp.name}-${name}.png` })
    }

    /* ---------- Primera vez: vacía, con la guía ---------- */
    await page.goto('./')
    await expect(page.getByRole('region', { name: 'Primeros pasos' })).toBeVisible()
    await noHorizontalScroll(page)
    await shot(page, '01-vacia')
    await axe(page, 'vacía')

    /* ---------- Con el ejemplo y la pantalla de Gabi ---------- */
    await page.getByRole('region', { name: 'Primeros pasos' }).getByRole('button', { name: 'Probar con el ejemplo' }).click()
    await expect(page.getByRole('heading', { name: 'Mandale baile (ejemplo)' })).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar la guía' }).click()

    const [gabi] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Abrir pantalla de Gabi' }).first().click()])
    watch(gabi)
    await gabi.setViewportSize({ width: 1920, height: 1080 })
    await expect(gabi.locator('.g-solo b')).toHaveText('Intro')
    await shot(gabi, '10-gabi-instrumental')

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(gabi.locator('.g-now')).toHaveText('la noche recién empieza en Córdoba')
    await noHorizontalScroll(page)
    await shot(page, '02-consola-linea')
    await shot(gabi, '11-gabi-linea')
    await axe(page, 'consola')

    // Coro por parte, con la línea marcada.
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('m')
    await page.keyboard.press('ArrowRight')
    await expect(gabi.locator('.g-parte p.g-now')).toHaveCount(1)
    await shot(page, '03-consola-parte')
    await shot(gabi, '12-gabi-parte')

    // Estilo C.
    await page.getByRole('radio', { name: 'Estilo C' }).click()
    await page.keyboard.press('m')
    await expect(gabi.locator('.gabi--c')).toBeVisible()
    await shot(gabi, '13-gabi-estilo-c')
    await page.getByRole('radio', { name: 'Estilo A' }).click()

    // Mensaje, cuenta y LOGO.
    await page.keyboard.press('F2')
    await expect(gabi.locator('.g-cartel')).toBeVisible()
    await shot(gabi, '14-gabi-mensaje')
    await shot(page, '04-consola-mensaje')
    await page.keyboard.press('Escape')
    await page.keyboard.press('c')
    await expect(gabi.locator('.g-cuenta')).toBeVisible()
    await shot(gabi, '15-gabi-cuenta')
    await page.keyboard.press('Escape')
    await page.keyboard.press('l')
    await shot(gabi, '16-gabi-logo')
    await page.keyboard.press('l')

    // La misma pantalla en un monitor 4:3 y en uno chico.
    await gabi.setViewportSize({ width: 1024, height: 768 })
    await page.keyboard.press('ArrowRight')
    await shot(gabi, '17-gabi-4x3')
    await gabi.setViewportSize({ width: 1920, height: 1080 })

    /* ---------- Canciones y editor ---------- */
    await page.getByRole('button', { name: 'Canciones', exact: true }).click()
    const lib = page.getByRole('dialog', { name: 'Canciones' })
    await expect(lib.getByRole('textbox', { name: 'Título' })).toHaveValue('Mandale baile (ejemplo)')
    await noHorizontalScroll(page)
    await shot(page, '05-editor')
    await axe(page, 'editor')
    await page.keyboard.press('Escape')
    await expect(lib).toBeHidden()

    /* ---------- Ayuda ---------- */
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Ayuda' })).toBeVisible()
    await shot(page, '06-ayuda')
    await axe(page, 'ayuda')
    await page.keyboard.press('Escape')

    expect(errors, 'errores en la consola del navegador').toEqual([])
    await context.close()
  })
}
