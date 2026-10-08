---
description: Resume el último respaldo del Cuaderno (pacientes, gravedad y pendientes)
---

1. Buscá la carpeta de respaldos en `CLAUDE.local.md`. Si no está configurada, ofrecé `/drive` o pedile a Miguel que te diga dónde está el archivo.
2. Avisale en una línea que vas a leer los datos de sus pacientes para hacer el resumen, y esperá que diga que sí.
3. Corré `python herramientas/resumen_respaldo.py "<carpeta o archivo>"`. Si pasás una carpeta, el script usa el respaldo más nuevo.
4. Contale el resultado en este orden, corto y en lenguaje de todos los días:
   - de cuándo es el respaldo (si tiene más de una semana, sugerile hacer uno nuevo);
   - **lo pendiente primero**: casos severos, gravedades para definir, visitas a confirmar y próximas acciones;
   - después los números generales por establecimiento.
5. Si pide algo más (por ejemplo "¿cómo viene tal caballo?"), buscá solo lo necesario en el respaldo. No copies el archivo a otro lado ni lo subas a ningún servicio.
