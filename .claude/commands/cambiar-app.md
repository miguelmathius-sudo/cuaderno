---
description: Modifica la app (una mejora o un arreglo) y publica la versión nueva
argument-hint: qué querés cambiar
---

Miguel quiere este cambio: $ARGUMENTS

1. Si el pedido no es claro, preguntá lo mínimo antes de tocar nada. Si el cambio afecta cómo se guardan los datos, explicale el riesgo y asegurate de que `normalizar()` en `docs/app.js` convierta los datos viejos.
2. Hacé el cambio en `docs/`, respetando las reglas de `CLAUDE.md`: nada que se conecte a internet y todo en castellano.
3. Probalo: `python -m http.server 8080 --directory docs` y abrí http://localhost:8080. Si tenés navegador integrado, usalo y revisá que no haya errores en la consola. Probá también sin conexión.
4. Subí la versión en `VERSION` (`docs/app.js`) y en `CACHE` (`docs/sw.js`) con el mismo número. Si agregaste archivos a `docs/`, sumalos a `ARCHIVOS` en `sw.js`.
5. Publicá:
   - `git status`: solo código, nada de `datos/`, respaldos, `.csv` ni `.backup`.
   - `git add -A`, `git commit -m "<qué cambió, en castellano>"` y `git push`.
   - Esperá a que GitHub Pages termine (`gh api repos/USUARIO/cuaderno/pages/builds/latest --jq .status` hasta que diga `built`).
6. Contale a Miguel: "La próxima vez que abras la app con internet va a aparecer *Hay una versión nueva*: tocá *Actualizar ahora*". Sus notas no se tocan al actualizar.
