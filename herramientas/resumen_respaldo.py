"""Resume un respaldo del Cuaderno (cuaderno-respaldo-AAAA-MM-DD.json) sin modificarlo.

Uso:
    python herramientas/resumen_respaldo.py ruta/al/respaldo.json

Si se pasa una carpeta, usa el respaldo mas nuevo que encuentre adentro.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


def elegir(ruta: Path) -> Path:
    if ruta.is_dir():
        candidatos = sorted(ruta.rglob("cuaderno-respaldo-*.json"), key=lambda p: p.stat().st_mtime)
        if not candidatos:
            sys.exit(f"No hay respaldos del Cuaderno en {ruta}")
        return candidatos[-1]
    return ruta


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    archivo = elegir(Path(sys.argv[1]))
    d = json.loads(archivo.read_text(encoding="utf-8"))
    if d.get("app") != "cuaderno":
        sys.exit("Ese archivo no es un respaldo del Cuaderno.")
    notas, fichas = d.get("notas", []), d.get("fichas", [])

    print(f"# Resumen de {archivo.name}")
    print(f"Exportado: {d.get('exportado', '?')}")
    estados = Counter(n.get("estado", "activa") for n in notas)
    print(f"\nNotas: {len(notas)} (activas {estados['activa']}, archivadas {estados['archivada']}, papelera {estados['papelera']})")

    caballos = {(f["establecimiento"].strip().lower(), f["caballo"].strip().lower()) for f in fichas}
    print(f"Fichas de pacientes: {len(fichas)} visitas, {len(caballos)} caballos")

    print("\n## Por establecimiento")
    for est, n in Counter(f["establecimiento"] for f in fichas).most_common():
        print(f"- {est}: {n} visitas")

    print("\n## Gravedad")
    for sev, n in Counter(f["severidad"] for f in fichas).most_common():
        print(f"- {sev}: {n}")

    pendientes = [f for f in fichas if f["severidad"] in ("Severa", "Confirmar") or f["estado"] == "A confirmar" or f.get("proxima_accion")]
    pendientes.sort(key=lambda f: ({"Severa": 0, "Confirmar": 1}.get(f["severidad"], 2), f["fecha"]))
    print(f"\n## Para atender ({len(pendientes)})")
    for f in pendientes:
        que = "definir gravedad" if f["severidad"] == "Confirmar" else ("confirmar visita" if f["estado"] == "A confirmar" else (f.get("proxima_accion") or "caso severo"))
        print(f"- {f['caballo']} ({f['establecimiento']}, {f['fecha'] or 'sin fecha'}): {que}")


if __name__ == "__main__":
    main()
