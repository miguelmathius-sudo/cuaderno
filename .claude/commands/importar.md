---
description: Trae datos viejos al Cuaderno (respaldo de ColorNote o planilla de Google Sheets)
---

Preguntale a Miguel qué quiere traer y seguí el camino que corresponda.

## A. Notas de ColorNote (se hace en el celular, sin la computadora)

Es lo más directo: la app descifra el respaldo de ColorNote dentro del teléfono.
1. En ColorNote: Configuración → Respaldo → hacer un respaldo en el almacenamiento del teléfono. Si ColorNote tiene contraseña, anotarla.
2. En el Cuaderno: Más → "Traer notas de ColorNote" → poner la contraseña (0000 si nunca puso una) → elegir el archivo del respaldo (se busca con el selector de archivos; si no aparece, buscar en Descargas o en una carpeta "colornote").
3. La app muestra cuántas notas encontró y pregunta si trae también las archivadas.
4. Si importa dos veces, no se duplica nada: se actualizan las que ya estaban.

Si el respaldo de ColorNote está en la computadora o en Drive, no hace falta procesarlo acá: que lo abra desde el celular con el mismo paso 2 (el selector de archivos del teléfono muestra Google Drive).

Después de importar, las notas de visitas se pasan a fichas desde cada nota: menú ⋮ → "Pasar a fichas de pacientes". Las notas viejas (tipo "Delirio (preso) rampas 11") también se entienden: toman el título de la nota como establecimiento y la fecha del texto. Recordale revisar cada tanda antes de guardar y destildar los renglones que no son caballos.

## B. Planilla "Revisiones Dentales - Miguel" (Google Sheets)

1. Avisale que para convertirla vas a leer datos de clientes y pedile permiso.
2. Conseguí el CSV:
   - Que la abra en Google Sheets → Archivo → Descargar → Valores separados por comas (.csv), y la guarde en la carpeta `datos/` de este proyecto; o
   - con Drive para escritorio o el conector (ver `CLAUDE.local.md` o `/drive`), exportala como CSV a `datos/`.
3. Convertila: `python herramientas/csv_a_respaldo.py datos/ARCHIVO.csv datos/planilla.cuaderno.json`
   Contale cuántas fichas salieron y si alguna quedó sin fecha.
4. Copiá `datos/planilla.cuaderno.json` a la carpeta de respaldos de Drive.
5. En el celular: Cuaderno → Más → Restaurar respaldo → elegir `planilla.cuaderno.json` desde Drive. Se combina con lo que ya tiene, sin duplicar.
6. Después de confirmar que está en el celular, ofrecele borrar las copias de `datos/` de la computadora.
