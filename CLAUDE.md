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
  - `src/show/Ensayo.tsx`: consola de ensayo provisoria con una letra inventada (`demoSong.ts`). La reemplaza la consola de la etapa 5.
  - Prueba con las dos ventanas: `npm run e2e` (Playwright con el Chrome instalado, en `e2e/`). Todavía no corre en el workflow.
- Próximo paso: etapa 5, la consola.
