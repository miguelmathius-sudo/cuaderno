---
description: Conecta Google Drive a esta computadora y organiza los respaldos del Cuaderno
---

Objetivo: que los respaldos que Miguel guarda desde el celular lleguen a su Google Drive, y que desde esta computadora Claude Code los pueda encontrar para hacer resúmenes o restaurarlos en otro teléfono.

La app del celular **no se conecta sola a Drive** (a propósito: así funciona sin internet y nada sale del teléfono sin que Miguel lo decida). El puente es el respaldo: Miguel lo guarda y elige mandarlo a Drive.

## 1. Elegir cómo accede esta computadora a Drive

Primero fijate si en esta sesión ya tenés herramientas de Google Drive (algún nombre con "drive"). Si las tenés, preguntale si prefiere usar esas.

**Opción A (recomendada): Google Drive para escritorio.** Hace que Drive aparezca como una carpeta más de la computadora.
- Windows: pedile permiso y ejecutá `winget install --id Google.GoogleDrive -e`. En Mac: https://www.google.com/drive/download/
- Que inicie sesión con su cuenta de Google (lo hace él).
- Buscá la carpeta: en Windows suele ser `G:\Mi unidad` o `G:\My Drive`. Probá con `ls` hasta encontrarla.

**Opción B: conector de Google Drive de Claude.** Que entre a claude.ai → Configuración → Conectores → Google Drive → Conectar, con la misma cuenta de Claude que usa acá. Después hay que reiniciar Claude Code. Verificá que aparezcan las herramientas de Drive.

## 2. Carpeta de respaldos

1. Creá en Drive una carpeta `Cuaderno - Respaldos` (con la opción A es una carpeta común; con la B usá la herramienta de crear carpeta).
2. Guardá la configuración en `CLAUDE.local.md`, en la raíz del proyecto. No se sube a GitHub y Claude Code lo lee solo en cada sesión:
   ```
   # Configuración de esta computadora
   - Carpeta de respaldos del Cuaderno: <ruta completa o "conector de Drive: Cuaderno - Respaldos">
   - Link de la app: https://USUARIO.github.io/cuaderno/
   ```

## 3. Probar el circuito completo

1. En el celular: Cuaderno → Más → **Guardar respaldo** → elegir **Drive** → carpeta `Cuaderno - Respaldos` → Guardar.
   (Si el teléfono no ofrece "Compartir", el archivo va a Descargas; desde ahí se sube a Drive con la app de Drive.)
2. Esperá un minuto y fijate si el archivo `cuaderno-respaldo-AAAA-MM-DD.json` aparece en la carpeta. **Solo listá el nombre, no lo abras** sin permiso.
3. Confirmale a Miguel que el circuito funciona.

## 4. Explicale cómo se usa (dejáselo por escrito, corto)

- **Una vez por semana:** Más → Guardar respaldo → Drive. La app avisa si pasaron 7 días.
- **Celular nuevo o perdido:** instalar la app desde el link, abrir Drive, descargar el último respaldo y en la app: Más → Restaurar respaldo.
- **Resumen de pacientes en la compu:** pedile a Claude `/resumen`.
