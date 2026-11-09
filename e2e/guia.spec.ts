import { expect, test } from '@playwright/test'
import { monitorGrande } from './fixtures.ts'

const SHOTS = process.env.SHOTS_DIR

test.beforeEach(({ context }) => monitorGrande(context))

test('primeros pasos, ayuda y movimiento reducido', async ({ page, context }) => {
  await page.goto('./')

  // Sin nada cargado: la guía y los estados vacíos dicen qué hacer.
  const guia = page.getByRole('region', { name: 'Primeros pasos' })
  await expect(guia).toContainText('0/3')
  await expect(page.getByRole('region', { name: 'Letra' })).toContainText('Todavía no hay canciones.')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/guia.png` })

  // Pasos 1 y 2 de una con el ejemplo (crea el tema y el setlist).
  await guia.getByRole('button', { name: 'Probar con el ejemplo' }).click()
  await expect(guia).toContainText('2/3')
  await expect(guia.getByRole('heading', { name: 'Cargá las canciones (hecho)' })).toBeVisible()

  // Paso 3: la pantalla abierta, pero sin pantalla completa.
  const [gabi] = await Promise.all([context.waitForEvent('page'), guia.getByRole('button', { name: 'Abrir pantalla de Gabi' }).click()])
  await expect(guia).toContainText('Falta un clic en la ventana de Gabi')
  await gabi.locator('.gabi-window').click()
  await expect(guia.getByRole('heading', { name: 'Todo listo para el show' })).toBeVisible()
  await expect(page.getByText('Pantalla conectada')).not.toContainText('falta')

  // Achicar y agrandar.
  await guia.getByRole('button', { name: 'Achicar' }).click()
  await page.getByRole('button', { name: /3\/3\s*Primeros pasos/ }).click()
  await guia.getByRole('button', { name: 'Cerrar la guía' }).first().click()
  await expect(guia).toBeHidden()

  // Ayuda con "?": atajos, ajuste de movimiento y volver a ver la guía.
  await page.keyboard.press('?')
  const ayuda = page.getByRole('dialog', { name: 'Ayuda' })
  await expect(ayuda).toContainText('Atajos durante el show')
  // Con la ayuda abierta, las flechas no mueven el show.
  await page.keyboard.press('ArrowRight')
  await expect(gabi.locator('.g-solo b')).toHaveText('Intro')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/ayuda.png` })

  await ayuda.getByRole('switch', { name: 'Reducir movimiento en las dos pantallas' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await expect(gabi.locator('html')).toHaveAttribute('data-motion', 'reduced')

  await page.keyboard.press('Escape')
  await expect(ayuda).toBeHidden()
  await page.keyboard.press('ArrowRight')
  await expect(gabi.locator('.g-now')).toHaveText('Llegamos de lejos con ganas de fiesta')

  await page.getByRole('button', { name: 'Ayuda (?)' }).click()
  await ayuda.getByRole('button', { name: 'Ver los primeros pasos' }).click()
  await expect(guia).toBeVisible()

  // El ajuste queda guardado en este equipo.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
})
