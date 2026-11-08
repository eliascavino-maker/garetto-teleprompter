import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronsRight,
  Gauge,
  ListMusic,
  Monitor,
  RotateCcw,
  Timer,
  TriangleAlert,
  Wifi,
} from 'lucide-react'
import { Button, Cue, Kbd, Pad, Panel, Pill, Segmented, Slider, Switch, Toast, Wordmark } from '../ui/components'
import './sistema.css'

/** Página de muestra del sistema de diseño. Sirve de referencia hasta que esté la consola. */
export function Sistema() {
  const [avance, setAvance] = useState<'linea' | 'parte'>('linea')
  const [estilo, setEstilo] = useState<'a' | 'c'>('a')
  const [marcar, setMarcar] = useState(true)
  const [velocidad, setVelocidad] = useState(1)
  const [fired, setFired] = useState<string | null>('Más lento')
  const [negro, setNegro] = useState(false)

  const mensajes = ['Repetí el coro', 'Más lento', 'Último coro', 'Cortamos acá', 'Enganchamos']

  return (
    <div className="sis">
      <header className="sis-head papel">
        <Wordmark size={40} />
        <h1>Sistema de diseño</h1>
        <p>Tokens, tipografía y componentes base de la consola y de la pantalla de Gabi.</p>
      </header>

      <section className="sis-sec" aria-labelledby="sec-color">
        <h2 id="sec-color">Color</h2>
        <div className="sis-swatches">
          {[
            ['--garetto', 'Violeta de marca', '#452D66'],
            ['--garetto-deep', 'Violeta oscuro', '#352257'],
            ['--lavanda', 'Lavanda', '#CFC2DE'],
            ['--foco', 'Foco · 7,0:1 sobre negro', '#A585E0'],
            ['--aire', 'Al aire', '#F0565B'],
            ['--ok', 'Conectado', '#3FD08A'],
            ['--alerta', 'Alerta', '#F2B544'],
          ].map(([token, name, hex]) => (
            <div key={token} className="sis-sw">
              <span style={{ background: `var(${token})` }} />
              <b>{name}</b>
              <code>
                {token} · {hex}
              </code>
            </div>
          ))}
        </div>
        <div className="sis-layers">
          {['0 · fondo', '1 · panel', '2 · fila', '3 · control', '4 · menú'].map((name, i) => (
            <div key={name} style={{ background: `var(--ink-${i})` }}>
              {name}
            </div>
          ))}
        </div>
      </section>

      <section className="sis-sec" aria-labelledby="sec-tipo">
        <h2 id="sec-tipo">Tipografía</h2>
        <div className="sis-grid">
          <div className="sis-block">
            <p className="sis-t28">Mandale baile</p>
            <p className="sis-t18">Setlist · 7 temas</p>
            <p className="sis-t14">Cuarteto · 4:10 · velocidad 1,0×</p>
            <p className="label">Atajo · F1</p>
            <p className="sis-clock tabular">01:12:47 · 02:14</p>
          </div>
          <div className="sis-read" aria-label="Muestra de la pantalla de Gabi">
            <span className="sis-read__now">que la noche es larga</span>
            <span className="sis-read__next">y el cuarteto no para</span>
            <span className="sis-read__c">Atkinson, estilo C</span>
          </div>
        </div>
      </section>

      <section className="sis-sec" aria-labelledby="sec-ctl">
        <h2 id="sec-ctl">Controles</h2>
        <div className="sis-row">
          <Button icon={ArrowLeft} kbd="←">
            Anterior
          </Button>
          <Button variant="primary" icon={ArrowRight} kbd="→">
            Siguiente
          </Button>
          <Button icon={ChevronsRight} kbd="⇧ →">
            Parte siguiente
          </Button>
          <Button variant="ghost" icon={RotateCcw}>
            Deshacer
          </Button>
          <Button icon={Monitor} aria-label="Abrir pantalla de Gabi" />
          <Button disabled kbd="→">
            Deshabilitado
          </Button>
        </div>
        <div className="sis-row">
          <Segmented
            label="Avance"
            value={avance}
            onChange={setAvance}
            options={[
              { value: 'linea', label: 'Línea' },
              { value: 'parte', label: 'Parte', kbd: 'M' },
            ]}
          />
          <Segmented
            label="Estilo de pantalla"
            value={estilo}
            onChange={setEstilo}
            options={[
              { value: 'a', label: 'Estilo A' },
              { value: 'c', label: 'Estilo C' },
            ]}
          />
          <Switch checked={marcar} onChange={setMarcar}>
            Marcar la línea actual
          </Switch>
        </div>
        <div className="sis-row" style={{ maxWidth: 360 }}>
          <Slider
            label="Velocidad"
            icon={Gauge}
            value={velocidad}
            min={0.25}
            max={4}
            step={0.05}
            format={(v) => `${v.toFixed(2).replace('.', ',')}×`}
            onChange={setVelocidad}
          />
        </div>
        <div className="sis-row">
          <Pill tone="live">Al aire</Pill>
          <Pill tone="ok" icon={Wifi}>
            Pantalla conectada
          </Pill>
          <Pill tone="alerta" icon={TriangleAlert}>
            Sin sincronizar
          </Pill>
          <Pill>Cuarteto</Pill>
          <Cue kind="silencio" />
          <Cue kind="corte" />
          <Cue kind="x2" />
          <Cue kind="solo" />
          <Kbd>Espacio</Kbd>
        </div>
      </section>

      <section className="sis-sec" aria-labelledby="sec-pads">
        <h2 id="sec-pads">Pads</h2>
        <div className="sis-pads">
          {mensajes.map((m, i) => (
            <Pad
              key={m}
              label={m}
              kbd={`F${i + 1}`}
              fired={fired === m}
              onClick={() => setFired(fired === m ? null : m)}
            />
          ))}
          <Pad tone="cnt" icon={Timer} label="Cuenta 4" kbd="C" />
          <Pad tone="negro" label="NEGRO" kbd="B" fired={negro} onClick={() => setNegro(!negro)} />
          <Pad tone="logo" label="LOGO" kbd="L" />
        </div>
      </section>

      <section className="sis-sec" aria-labelledby="sec-panel">
        <h2 id="sec-panel">Panel y avisos</h2>
        <div className="sis-grid">
          <Panel card title="Setlist" icon={ListMusic} actions={<Kbd>S</Kbd>} style={{ height: 180 }}>
            <p style={{ padding: 14, color: 'var(--chalk-3)' }}>Contenido del panel.</p>
          </Panel>
          <div className="sis-toasts">
            <Toast icon={Check} action={{ label: 'Deshacer', onClick: () => {} }}>
              Canción guardada
            </Toast>
            <Toast icon={TriangleAlert} tone="alerta">
              Sin internet: los cambios quedan en la notebook
            </Toast>
          </div>
        </div>
      </section>

      <section className="sis-sec" aria-labelledby="sec-espera">
        <h2 id="sec-espera">Espera y LOGO</h2>
        <div className="sis-espera papel">
          <div className="sis-espera__logo">
            <Wordmark size={88} />
          </div>
          <p className="sis-espera__frase">MANDALE BAILE</p>
        </div>
      </section>
    </div>
  )
}
