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

- El proyecto está creado con Vite, `npx supabase init` y `git init`, pero todavía no tiene commits.
- El esquema inicial está escrito y todavía no se aplicó.
- GitHub CLI está instalado (`C:\Program Files\GitHub CLI\gh.exe`).
- Próximo paso: el usuario corre `gh auth login --web --git-protocol https` y `npx supabase login`. Después se crea el proyecto de Supabase en `sa-east-1` (es el último proyecto gratis de la cuenta), se aplica el esquema, se crea el repo `garetto-teleprompter` y se configura el deploy a GitHub Pages.
