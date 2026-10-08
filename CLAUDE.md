# Cuaderno de Miguel

Instrucciones para Claude Code. Este proyecto es de **Miguel**, odontólogo equino. No es programador: hablale en castellano rioplatense, simple, un paso por vez, y esperá que confirme antes de seguir. Nada de jerga (si tenés que decir "repositorio", explicá qué es en una frase).

## Qué es

Una app de notas para el celular, inspirada en ColorNote (la app que Miguel usa hace años), que **funciona sin internet**. Suma lo que ColorNote no tiene: pasar las notas de visitas a **fichas de pacientes**, ver la historia de cada caballo, un panel con lo pendiente, PIN con cifrado y respaldos.

- La app vive en `docs/` (GitHub Pages exige ese nombre). Es HTML + JS sin dependencias ni compilación.
- Se instala en el celular como app (PWA): se abre una vez con internet desde un link, se agrega a la pantalla de inicio y desde ahí funciona sin conexión.
- Los datos (notas y fichas) quedan **solo en el celular** (IndexedDB). La página tiene una Content-Security-Policy con `connect-src 'none'`: no puede mandar nada a ningún servidor. **No agregues nunca código que envíe datos afuera** (analytics, sincronización, APIs, fuentes de Google, CDNs). Todo tiene que seguir funcionando en modo avión.

**Decisión de Miguel (7/10/2026):** ColorNote sigue siendo donde escribe y donde se guardan sus notas (se sincroniza solo con su cuenta). El Cuaderno se usa como **buscador**: trae una copia con «Actualizar desde ColorNote» (pantalla Preguntar) y responde preguntas. Las notas que ya no están en el respaldo nuevo pasan a la papelera del Cuaderno. La disciplina conviene escribirla en la nota de ColorNote (renglón "Polo" o "Salto").

## Estructura

| Ruta | Qué hace |
|---|---|
| `docs/index.html` | Pantallas: Notas, Calendario, Pacientes, Panel, Más; editor; diálogos |
| `docs/app.js` | Lógica de la interfaz. `VERSION` arriba de todo |
| `docs/store.js` | Guardado en IndexedDB y cifrado por PIN (PBKDF2 + AES-GCM) |
| `docs/parser.js` | Lee el texto de una nota y arma fichas (reglas de Miguel, ver abajo) |
| `docs/preguntas.js` | Pantalla Preguntar: entiende preguntas en castellano (período, polo/salto, caballo, cliente, hallazgo) y hace las cuentas con reglas fijas, sin internet. No es un modelo de IA |
| `docs/colornote.js` | Importa respaldos cifrados de ColorNote (AES-128-CBC, clave MD5(PIN + "ColorNote Fixed Salt"), IV en cero, cabecera de 28 bytes) |
| `docs/sw.js` | Service worker: guarda la app para uso sin internet. `CACHE` = versión |
| `herramientas/` | Scripts de Python para la computadora (no forman parte de la app) |
| `datos/` | Carpeta local para respaldos y planillas. **Nunca se sube a internet** (está en `.gitignore`) |

## Reglas de las fichas (acordadas con Miguel, no cambiarlas sin preguntarle)

- Un paciente es **Establecimiento + Caballo**: hay caballos con el mismo nombre en distintos establecimientos.
- **La fecha nunca se inventa.** Si la nota no la dice, la app la pide.
- **Gravedad general:** si la nota menciona una sola gravedad (todo "leve"), se toma esa. Si mezcla ("lesión leve por puntas severas") o no dice ninguna, queda **Confirmar** y Miguel la define.
- Estado: Realizada / A confirmar. "A confirmar" también sirve para visitas programadas.
- Formato de nota que entiende el lector: fecha ("26 Febrero 2026" o "26/02/2026"), establecimiento entre comillas, cada caballo con viñeta (•) y sus hallazgos debajo. También entiende el formato viejo de ColorNote ("Delirio (preso) rampas 11": nombre y hallazgos en la misma línea, con el título de la nota como establecimiento).
- **Disciplina** (Polo / Salto / Otra): se elige por nota (rara vez se mezclan en una misma nota) y las fichas la heredan; también se puede escribir "Polo" o "Salto" solo en uno de los primeros renglones. En «Más → Disciplina de cada nota» se completan todas juntas.
- **Preguntar** cuenta las fichas guardadas y también las visitas de notas que todavía no se pasaron a fichas (las lee al vuelo y avisa que están "sin revisar").
- Columnas de la planilla histórica "Revisiones Dentales - Miguel": Fecha, Establecimiento, Caballo, Oclusion, Hallazgos, Severidad_General, Proxima_Accion, Estado, Veterinario, Fecha_Carga.

## Privacidad: regla importante

La app no manda datos a ningún lado, **pero vos (Claude) sí**: todo lo que leas de un respaldo o de Drive viaja a los servidores de Anthropic para que puedas procesarlo. Por eso:

1. Antes de leer un respaldo, una planilla o una nota con datos de clientes, avisale a Miguel en una línea y pedile permiso.
2. Preferí los scripts de `herramientas/` (por ejemplo `resumen_respaldo.py`) antes que leer el JSON completo.
3. Nunca subas `datos/`, respaldos, CSV ni archivos `.backup` a GitHub ni a ningún servicio. Antes de cada `git push`, corré `git status` y revisá que solo haya archivos de código.
4. El repositorio de GitHub es público (lo exige GitHub Pages gratis): solo contiene el código de la app, sin datos.

## Comandos guiados

- `/instalar`: primera vez. Publica la app y guía la instalación en el celular.
- `/drive`: conecta Google Drive a esta computadora y organiza los respaldos.
- `/importar`: trae datos viejos (ColorNote o la planilla de Google Sheets).
- `/resumen`: lee el último respaldo y arma un resumen de pacientes y pendientes.
- `/cambiar-app`: modifica la app y publica la versión nueva.

Si Miguel pide algo con sus palabras ("quiero instalarla", "¿qué tengo pendiente?"), usá el comando que corresponda aunque no lo escriba.

## Al modificar la app

1. Hacé el cambio en `docs/`.
2. Probalo: `python -m http.server 8080 --directory docs` y abrí http://localhost:8080 (o usá la vista previa del navegador de Claude Code si está disponible). Revisá también el modo avión: en DevTools, "Offline".
3. Subí la versión en **dos lugares iguales**: `VERSION` en `docs/app.js` y `CACHE` en `docs/sw.js` (por ejemplo 1.0.0 → 1.1.0). Si no, el celular sigue mostrando la versión vieja.
4. Si agregás un archivo nuevo a `docs/`, sumalo a la lista `ARCHIVOS` de `sw.js`.
5. Publicá (ver `/cambiar-app`). En el celular aparece "Hay una versión nueva" la próxima vez que abra la app con internet.

No cambies la forma de los datos guardados (campos de notas y fichas) sin hacer que `normalizar()` en `app.js` convierta los datos viejos: Miguel no puede perder sus notas.
