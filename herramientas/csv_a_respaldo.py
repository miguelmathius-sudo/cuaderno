"""Convierte la planilla «Revisiones Dentales - Miguel» (exportada como CSV) en un respaldo
que el Cuaderno puede restaurar (Más → Restaurar respaldo).

Uso:
    python herramientas/csv_a_respaldo.py planilla.csv [salida.json]

Columnas esperadas (como en la planilla):
    Fecha, Establecimiento, Caballo, Oclusion, Hallazgos, Severidad_General,
    Proxima_Accion, Estado, Veterinario, Fecha_Carga
"""
from __future__ import annotations

import csv
import json
import re
import sys
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

SEVS = {"severa": "Severa", "moderada": "Moderada", "leve": "Leve", "confirmar": "Confirmar",
        "sin hallazgos": "Sin hallazgos", "sin datos": "Confirmar"}
ESTADOS = {"realizada": "Realizada", "a confirmar": "A confirmar", "pendiente": "A confirmar"}


def fecha_iso(valor: str) -> str:
    """Acepta 26/02/2026, 26-02-2026 o 2026-02-26. Cualquier otra cosa (p. ej. la palabra 'Fecha') queda vacia."""
    v = (valor or "").strip()
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", v)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$", v)
        if not m:
            return ""
        d, mo, y = map(int, m.groups())
        if y < 100:
            y += 2000
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return ""


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    origen = Path(sys.argv[1])
    destino = Path(sys.argv[2]) if len(sys.argv) > 2 else origen.with_suffix(".cuaderno.json")

    texto = origen.read_text(encoding="utf-8-sig")
    sep = ";" if texto.count(";") > texto.count(",") else ","
    filas = list(csv.DictReader(texto.splitlines(), delimiter=sep))

    fichas, sin_fecha = [], 0
    for f in filas:
        g = {k.strip().lower(): (v or "").strip() for k, v in f.items() if k}
        caballo = g.get("caballo", "")
        if not caballo:
            continue
        fecha = fecha_iso(g.get("fecha", ""))
        sin_fecha += not fecha
        fichas.append({
            "id": "f-" + uuid.uuid4().hex[:12],
            "fecha": fecha,
            "establecimiento": g.get("establecimiento", ""),
            "caballo": caballo,
            "oclusion": g.get("oclusion", ""),
            "hallazgos": g.get("hallazgos", ""),
            "severidad": SEVS.get(g.get("severidad_general", "").lower(), "Confirmar"),
            "estado": ESTADOS.get(g.get("estado", "").lower(), "Realizada"),
            "proxima_accion": g.get("proxima_accion", ""),
            "veterinario": g.get("veterinario", "") or "Miguel",
            "fecha_carga": fecha_iso(g.get("fecha_carga", "")) or date.today().isoformat(),
            "nota_id": "",
            "nota_original": "",
        })

    respaldo = {"app": "cuaderno", "version": 1,
                "exportado": datetime.now(timezone.utc).isoformat(),
                "notas": [], "fichas": fichas, "ajustes": {}}
    destino.write_text(json.dumps(respaldo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(fichas)} fichas convertidas -> {destino}")
    if sin_fecha:
        print(f"Atencion: {sin_fecha} fichas no tienen fecha valida. La app las va a mostrar, pero conviene corregirlas.")


if __name__ == "__main__":
    main()
