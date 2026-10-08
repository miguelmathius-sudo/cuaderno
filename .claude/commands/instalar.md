---
description: Publica la app y guía a Miguel para instalarla en el celular (primera vez)
---

Vas a guiar a Miguel para dejar el Cuaderno instalado en su celular. Seguí estos pasos **de a uno**: explicá qué vas a hacer, hacelo (o pedile que lo haga él cuando corresponda) y confirmá que salió bien antes de pasar al siguiente. Si algo falla, explicá el problema en palabras simples y proponé cómo seguir.

Contale primero el plan en 3 líneas:
1. Publicar la app en internet. Se sube **solo el programa**, nunca sus notas.
2. Abrir el link en el celular e instalarla como app.
3. Probar que funciona sin internet y traer sus notas de ColorNote.

## 1. Herramientas de la computadora

Revisá si están `git`, `gh` (GitHub CLI) y `python` (`git --version`, `gh --version`, `python --version`).
Si falta alguna, pedile permiso y ofrecé instalarla. En Windows:
`winget install --id Git.Git -e`, `winget install --id GitHub.cli -e`, `winget install --id Python.Python.3.12 -e`.
En Mac: `brew install git gh python`. Después de instalar puede hacer falta cerrar y volver a abrir Claude Code.

## 2. Cuenta de GitHub

GitHub es donde se va a publicar el programa, gratis. Preguntale si tiene cuenta.
- Si no tiene, que la cree **él mismo** en https://github.com/signup (vos no creás cuentas).
- Para conectar esta computadora con su cuenta, pedile que abra una terminal (en la app de Claude: panel Terminal; o PowerShell) y pegue:
  `gh auth login --web -h github.com --git-protocol https`
  Se abre el navegador, copia el código que aparece y acepta. Después verificá con `gh auth status`.

## 3. Publicar la app

1. Si la carpeta no es un repositorio git, `git init -b main`.
2. Si git no tiene nombre y email configurados, usá los de GitHub sin exponer su email personal:
   `gh api user --jq .login` y `gh api user --jq .id` → email `ID+USUARIO@users.noreply.github.com`.
   `git config user.name "USUARIO"` y `git config user.email "ID+USUARIO@users.noreply.github.com"`.
3. `git add -A` y **revisá `git status`**: solo tiene que haber código (`docs/`, `herramientas/`, `.claude/`, `CLAUDE.md`, `LEEME.md`, `.gitignore`). Si ves respaldos, `.json` de datos, `.csv`, `.backup` o la carpeta `datos/`, pará y sacalos antes de seguir.
4. `git commit -m "Cuaderno: primera versión"`.
5. Preguntale el nombre del link (por defecto `cuaderno`). Creá el repositorio público y subilo:
   `gh repo create cuaderno --public --source . --push --description "Cuaderno: notas sin internet"`.
   Explicale que "público" significa que cualquiera puede ver el programa, no sus datos: los datos nunca salen del celular.
6. Activá GitHub Pages desde la carpeta `docs`:
   `gh api -X POST repos/USUARIO/cuaderno/pages -f "source[branch]=main" -f "source[path]=/docs"`
7. Esperá a que esté listo (puede tardar 1 o 2 minutos). Revisá cada 30 segundos, máximo 10 veces:
   `gh api repos/USUARIO/cuaderno/pages --jq .status` hasta que diga `built`.
8. El link es `https://USUARIO.github.io/cuaderno/`. Comprobá que responde (`curl -sI` al link, código 200).

**Plan B si GitHub no funciona:** Netlify Drop (https://app.netlify.com/drop). Miguel crea una cuenta gratis él mismo y arrastra la carpeta `docs` a esa página. Ojo: para publicar cambios después hay que volver a arrastrarla.

## 4. Instalar en el celular

1. Generá un QR para no tener que tipear el link: `python -m pip install "qrcode[pil]"` (si hace falta) y `python herramientas/qr.py https://USUARIO.github.io/cuaderno/`. También podés sugerirle que se mande el link por WhatsApp.
2. Guialo según su teléfono (preguntale cuál tiene):
   - **Android (Chrome):** abrir el link → menú ⋮ arriba a la derecha → "Instalar app" o "Agregar a la pantalla principal" → Instalar.
   - **iPhone (Safari, no Chrome):** abrir el link → botón Compartir (cuadrado con flecha) → "Agregar a inicio" → Agregar.
3. Que abra la app **desde el ícono nuevo** (no desde el navegador).

## 5. Probar sin internet

1. Con la app abierta, que ponga el celular en **modo avión**.
2. Que cierre la app del todo y la vuelva a abrir desde el ícono. Tiene que abrir normal.
3. Que cree una nota de prueba, la cierre y la vuelva a abrir. Tiene que seguir ahí.
4. Que saque el modo avión.

## 6. Traer sus notas y dejarla segura

1. **Notas de ColorNote** (Android): en ColorNote, Configuración → Respaldo → hacer un respaldo en el teléfono. Después, en el Cuaderno: Más → "Traer notas de ColorNote" → elegir ese archivo. La contraseña es 0000 si nunca le puso una a ColorNote. No hace falta borrar ColorNote: puede seguir teniéndola hasta confiar en la app nueva.
2. **Pasar visitas a fichas:** que abra una nota de visita → menú ⋮ → "Pasar a fichas de pacientes". Revisa, completa lo que falta y guarda.
3. **PIN** (recomendado, son datos de clientes): Más → Seguridad → Poner PIN. Avisale que si se lo olvida no hay forma de recuperar las notas, salvo desde un respaldo.
4. **Primer respaldo:** Más → Guardar respaldo → mandarlo a Google Drive. Para organizarlo, seguí con `/drive`.

Al terminar, dejale un resumen corto: el link de la app, que funciona sin internet, que haga un respaldo por semana, y que para cambiar algo de la app te lo pida con `/cambiar-app`.
