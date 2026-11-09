# Gabi Garetto · Teleprompter

Teleprompter de letras para Gabi Garetto, voz de La Garetto (cuarteto y cumbia, Córdoba). Proyecto independiente de cualquier otro cancionero.

- Responder siempre en español rioplatense, con voseo.
- La propuesta visual aprobada está en `docs/propuesta.html` (también publicada en https://claude.ai/artifact/DTa4mj9dnkRS99U2d2FxbF).
- Skills de diseño del proyecto: `frontend-design`, `ui-ux-pro-max` e `interface-design`. Para las pruebas con las dos ventanas: `webapp-testing`.

## Cómo se usa en el show

- Una sola notebook. La consola del operador va en la pantalla de la notebook y la pantalla de Gabi en un monitor de piso por HDMI, con pantalla extendida. Gabi lee de pie a 1 o 2 metros y no toca nada.
- Tiene que funcionar 100% sin internet. La ventana de Gabi se abre con `window.open` y se sincroniza con `BroadcastChannel`.
- Navegador: Chrome. Se usa la Window Management API para mandar la ventana al segundo monitor, con alternativa manual (arrastrar la ventana y F11).

## Decisiones aprobadas

- **Consola:** dirección A, "Mesa de luces": setlist, letra y vista previa más controles en tres columnas redimensionables. Los mensajes, la cuenta regresiva, NEGRO y LOGO van como pads grandes (estilo B).
- **Pantalla de Gabi:** estilo A (letra alineada a la izquierda, línea actual en `#A585E0`, siguiente más tenue, anterior casi invisible). Hay un selector para pasar al estilo C: una sola línea gigante en Atkinson Hyperlegible.
- **Avance:** por línea o por parte (estrofa o estribillo completo), se cambia con la tecla M. En modo parte hay una opción para marcar la línea actual. Cada canción puede guardar su modo; si no tiene, usa el de la consola. Shift siempre salta a la parte siguiente. Si una parte no entra, la letra se achica hasta unos 64 px en 1080p y, si igual no entra, se divide en dos pantallas ("1/2").
- **Datos:** offline-first. IndexedDB es la fuente durante el show. Supabase sirve de respaldo y para sincronizar entre equipos. Una sola cuenta para toda la banda. Backup exportable en .json.
- **Firma visual:** los temas enganchados quedan unidos por una costura violeta, como la "TT" unida del logo.

## Identidad

- Colores: violeta de marca `#452D66`, violeta oscuro `#352257`, lavanda `#CFC2DE` y foco `#A585E0`, con contraste de 7,0:1 sobre `#000` (pasa AAA). La consola usa grafito cálido, de `#120F14` a `#322C38`, con bordes finos.
- Tipografía: Montserrat para la interfaz y Atkinson Hyperlegible para el estilo C de Gabi. Las dos van autoalojadas.
- Logo: "LA" chico arriba de "GARETTO", con la TT unida, en lavanda grisácea sobre violeta con textura de papel arrugado. Todavía no hay archivo: hay que rearmarlo como SVG. Referencia: Instagram @lagarettorey.
- Espera y LOGO: fondo violeta con papel arrugado hecho con SVG (`feTurbulence` + `feDiffuseLighting`), el logo que respira y "MANDALE BAILE" en lavanda.
- Título de la página: "Gabi Garetto · Teleprompter".

## Stack

Vite + React 19 + TypeScript, con CSS propio sobre variables de tema. Librerías:

- `lucide-react` para los íconos.
- `@dnd-kit` para arrastrar el setlist.
- `idb` para IndexedDB.
- `vite-plugin-pwa` para que funcione offline.
- `mammoth` y `pdfjs-dist` para importar .docx y PDF, cargadas solo al importar.
- `@supabase/supabase-js` para la sincronización.
- Vitest para los tests y Playwright para probar las dos ventanas.

Supabase CLI se usa con `npx supabase`, porque está instalado como devDependency. El esquema está en `supabase/migrations/`.

## Secretos

La contraseña de la base y las credenciales de prueba van solo en `.env.local`, que está en `.gitignore`. Nunca se commitean. La anon key de Supabase es pública por diseño: lo que protege los datos es RLS.

## Etapas

Cada etapa lleva un commit o más, y el deploy tiene que quedar en verde.

1. Repo en GitHub y deploy vacío a GitHub Pages con Actions.
2. Sistema de diseño en código: tokens, fuentes y componentes base.
3. Modelo de datos, IndexedDB y parser de letras, con tests.
4. Sincronización entre ventanas y pantalla de Gabi, con tests.
5. Consola.
6. Editor e importación (.txt, .docx y PDF), con deshacer y backup.
7. PWA offline, Wake Lock y Window Management.
8. Onboarding, estados vacíos, ayuda con "?" y movimiento reducido.
9. Revisión con Playwright y capturas en 1366×768, 1920×1080 y tablet.

## Estado al 2026-11-08

- Etapa 1 terminada. Repo público: https://github.com/eliascavino-maker/garetto-teleprompter. Sitio: https://eliascavino-maker.github.io/garetto-teleprompter/ (deploy con `.github/workflows/deploy.yml`: lint, build y Pages).
- Supabase: proyecto `garetto-teleprompter` (ref `hsyibrsvhuohmwwkzocc`, `sa-east-1`, org "La Garetto Tel"), vinculado con `npx supabase link`. El esquema inicial ya está aplicado.
- `.env` (commiteado) tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env.local` tiene `SUPABASE_DB_PASSWORD`.
- GitHub CLI no está en el PATH de las terminales abiertas antes de instalarlo: usar `C:\Program Files\GitHub CLI\gh.exe`. `npx supabase login` y `gh auth login` piden TTY: el usuario los corre en su terminal, o Claude los lanza en segundo plano y le pasa el código.
- Etapa 2 terminada: tokens en `src/styles/tokens.css`, base en `src/styles/base.css`, componentes en `src/ui/` (Button, Pad, Pill, Cue, Switch, Segmented, Slider, Panel, Toast, Wordmark provisorio y clase `.papel`). Fuentes autoalojadas con `@fontsource-variable/montserrat` y `@fontsource/atkinson-hyperlegible`. Por ahora la app muestra `src/sistema/Sistema.tsx` como muestra del sistema.
- Vite usa `base: '/garetto-teleprompter/'` también en desarrollo y preview: la app local está en `http://localhost:5173/garetto-teleprompter/`.
- Falta rearmar el logo como SVG: `Wordmark` es texto provisorio.
- Etapa 3 terminada, en `src/data/`:
  - `types.ts`: modelo (Song, Section, Line, Setlist, ajustes). Sigue el esquema SQL, en camelCase.
  - `db.ts`: IndexedDB con `idb` (stores `songs`, `setlists` y `kv`).
  - `repo.ts`: altas, bajas lógicas, ajustes y reglas de sincronización (`pending`, `markSynced`, `applyRemote` con última edición gana).
  - `parser.ts`: texto plano a partes. Entiende encabezados, coros repetidos, indicaciones (x2, corte, silencio, solo) y descarta acordes.
  - Tests con Vitest y `fake-indexeddb` (`npm test`). El workflow corre los tests antes del build.
- Etapa 4 terminada:
  - `src/show/cursor.ts`: avance por línea o por parte (pasos, Shift = parte, división en pantallas de hasta 8 líneas).
  - `src/show/view.ts`: la consola arma la vista (`ShowState`) y la ventana de Gabi solo la dibuja.
  - `src/show/channel.ts`: `ConsoleLink` y `GabiLink` sobre BroadcastChannel. Siempre se manda el estado completo, con saludo, latido y aviso de cierre.
  - `src/show/useShow.ts`: estado del show en la consola, con atajos (→, PageDown y Espacio avanzan; Shift salta de parte; M, B, L, C, F1–F5, Esc).
  - `src/gabi/`: pantalla de Gabi (estilos A y C, parte, instrumental, NEGRO, LOGO, mensaje, cuenta, rotación y espejo) y la ventana en `#/gabi`.
  - Prueba con las dos ventanas: `npm run e2e` (Playwright con el Chrome instalado, en `e2e/`). Todavía no corre en el workflow.
- Etapa 5 terminada, en `src/console/`:
  - `Console.tsx`: barra (relojes de show y tema, EN VIVO, pantalla), tres columnas con divisores que se arrastran, atajos y paso entre temas (→ al final pasa al siguiente; ← al comienzo vuelve al final del anterior).
  - `SetlistPanel.tsx`: elegir, crear, renombrar y borrar setlists; buscar y agregar temas (`/`); arrastrar con `@dnd-kit`; enganchar y desenganchar con la costura violeta.
  - `LyricsPanel.tsx` y `ControlPanel.tsx`: letra con la línea actual y controles (vista previa, avance, modo, estilo, montaje, pads F1–F5, mensaje libre F6, cuenta, LOGO, NEGRO).
  - `prefs.ts`: setlist abierto, posición, relojes y columnas en localStorage, para retomar después de recargar.
  - `src/data/store.ts`: almacén en memoria sobre IndexedDB para React (`useData`), con aviso entre pestañas.
  - `src/data/setlist.ts`: operaciones puras del setlist, con tests.
  - Sin editor todavía: el estado vacío ofrece "Cargar un ejemplo para probar" (`src/show/demoSong.ts`).
- Etapa 6 terminada:
  - `src/editor/Library.tsx`: pantalla "Canciones" que se abre encima de la consola (la consola queda `inert` y Gabi sigue conectada). Lista con búsqueda, nuevo tema, importar (botón o arrastrar archivos), bajar y restaurar backup.
  - `src/editor/Editor.tsx`: la letra se edita como texto (`[Coro x2]`, `(corte)`) con la vista "Cómo queda" al lado. Botones para marcar partes e indicaciones en el renglón del cursor, autoguardado, Ctrl+Z / Ctrl+Y propios (`history.ts`) y Ctrl+S. Ofrece usar el primer renglón como título.
  - `src/editor/draft.ts`: borrador, duración "4:10" y operaciones de texto, con tests.
  - `src/import/`: `.txt` (UTF-8 o Windows-1252), `.docx` con mammoth y PDF con pdf.js, los dos cargados solo al importar. Lo puro va en `text.ts`, con tests.
  - `src/data/backup.ts`: armar y validar el .json. Restaurar reemplaza las filas del backup y se puede deshacer (`Repo.putRows` / `revertRows`).
  - Avisos con "Deshacer" (y Ctrl+Z) en la consola: sacar un tema del setlist, borrar setlist o tema, importar y restaurar.
  - Parser: saca acordes entre corchetes (`[Am]Hola`), informa los renglones de acordes descartados y conserva el tipo en `[Coro final]`.
  - e2e: `e2e/editor.spec.ts`, con archivos de prueba armados en `e2e/fixtures.ts`.
- Pendiente de decidir: la velocidad de la canción (`speed`) y el avance automático que muestra la propuesta. Hoy el avance es solo manual.
- Etapa 7 terminada:
  - PWA con `vite-plugin-pwa` (`registerType: 'prompt'`): precachea todo (unos 2,6 MB, con mammoth, pdf.js y su worker). Nunca se actualiza sola: la consola muestra "Actualizar" y el operador decide. Avisa "la app ya funciona sin internet" y muestra "Sin internet" en la barra. Íconos en `public/` (la TT del favicon).
  - `src/platform/wakeLock.ts`: `useWakeLock`. Lo usan la ventana de Gabi (siempre) y la consola (con la pantalla conectada o EN VIVO).
  - `src/platform/screens.ts`: Window Management. `openGabiWindow` abre la ventana antes de esperar nada (para que Chrome no la bloquee) y después la mueve y estira al monitor externo. Si no hay permiso o hay un solo monitor, avisa qué hacer.
  - La ventana de Gabi le manda a la consola `ScreenInfo` (pantalla completa, tamaño, Wake Lock) en el saludo y el latido. La consola lo muestra en la pastilla ("falta pantalla completa"). Un clic en la ventana de Gabi la pone en pantalla completa; mientras falte, muestra un aviso que se esconde si no se mueve el mouse.
  - e2e: `e2e/offline.spec.ts` corre contra `vite preview` (puerto 5198, segundo `webServer` de Playwright) y prueba consola, ventana de Gabi e importación sin internet.
  - Falta probarlo con un monitor de verdad por HDMI (permiso de Window Management y pantalla completa en el segundo monitor).
- Etapa 8 terminada:
  - `src/console/Guide.tsx`: primeros pasos (cargar canciones, armar el setlist, conectar la pantalla). Cada paso se marca solo; solo el que toca muestra el detalle. Flota abajo a la izquierda de la letra, se achica (en pleno show queda achicada) y se cierra. Estado en localStorage (`garetto-teleprompter:guia`).
  - `src/console/Help.tsx`: ayuda con `?` o el botón de la barra. Atajos, cómo conectar el monitor, formato de la letra y ajustes del equipo ("Reducir movimiento" y "Ver los primeros pasos"). Mientras está abierta, los atajos del show no corren.
  - Estados vacíos de la letra: sin canciones, sin setlist, setlist vacío y tema sin letra.
  - Movimiento reducido: `src/platform/motion.ts` pone `data-motion="reduced"` en `<html>` si lo pide Windows o el ajuste del equipo (`DeviceSettings.reduceMotion`, viaja a la ventana de Gabi en el estado). Las reglas están en `base.css`.
  - e2e: `e2e/guia.spec.ts`. Las demás pruebas arrancan con la guía cerrada (`sinGuia` en `e2e/fixtures.ts`).
- Etapa 9 terminada:
  - e2e/revision.spec.ts recorre la app en 1366×768, 1920×1080, tablet 1024×768 y tablet vertical 820×1180. Falla si hay errores en la consola del navegador, scroll horizontal o problemas graves de accesibilidad (axe, con la vista previa de Gabi excluida por la línea anterior casi invisible). Con SHOTS_DIR guarda capturas.
  - Las pruebas de Playwright corren en el workflow antes del build (Chrome del runner, un reintento en CI).
  - Arreglos de la revisión: las teclas del show se toman en captura (un selector o pad con foco no las recibe); por debajo de 1024 px la consola va en dos columnas con el setlist en un panel aparte y el editor apila "Cómo queda"; en pantallas táctiles los botones de las filas del setlist quedan visibles; columnas más anchas por defecto en monitores de 1600 px o más; contraste de líneas cantadas, números y contador de la guía.
- Pendiente: probar con el monitor de verdad por HDMI, el logo en SVG y decidir el avance automático (speed).
