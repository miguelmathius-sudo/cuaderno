"""Arma fichas (una por caballo y visita) a partir de los tramos de notas de ColorNote con fecha.

Uso:
    python herramientas/ordenar_visitas.py datos/2026-segmentos.json datos/2026-fichas.json

Reglas acordadas con Miguel (octubre 2026):
- Lugar = renglon entre comillas del dia. Cliente = titulo de la nota, salvo que el titulo sea el lugar.
- "°Nombre" es el cliente de los caballos que siguen (marca de Miguel en lugares con varios clientes).
- Un renglon suelto arriba de un grupo de caballos ("Agus Brey", "Bertoldi:") es el cliente de esos caballos.
- Solo cuenta odontologia: medicacion, pendientes y proximas visitas no son caballos atendidos.
- Gravedad: si menciona una sola (leve/moderada/severa) se toma; si mezcla o no dice, queda "Confirmar".
Los casos dudosos quedan con "duda" para revisarlos.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata

BULLET = re.compile(r"^[\s⁠]*[•·●*\-–]\s*[⁠]*")
CLIENTE = re.compile(r"^[\s⁠]*°\s*")  # "°Cande": cliente de los caballos que siguen
COMILLAS = re.compile(r'^\s*["“”«](.+?)["“”»]\s*(.*)$')
# Encabezados que no son clientes: lo que viene debajo no son caballos atendidos (o es un rotulo)
NO_ATENDIDOS = re.compile(r"^(medicaci|recomendaci|pendiente|proxim|embarque|entregas|septiembre|octubre|noviembre|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|turno)", re.I)
ROTULOS = re.compile(r"^(lote|doma|donante|padrillo|cuida|yeguas|potrill|argentinos|r)\b", re.I)
PELAJES = re.compile(r"tordill|torda|alaz|zain|colorad|gatead|picas|tostad|moro|rosill|bay[oa]|overo|lobun|oscur|padrillo|apalous|criol|lobita|negr|blanc|petis|yegua|potr", re.I)
DOSIS = re.compile(r"\d+\s*(ml|mg|cc|gr|comp)|por \d+ d[ií]as|v[ií]a oral|/d[ií]a", re.I)


def norm(s: str) -> str:
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode().strip(" .:\t")


def gravedad(texto: str) -> str:
    t = norm(texto)
    n = []
    if re.search(r"\blev(e|es)\b", t): n.append("Leve")
    if re.search(r"\bmoderad[oa]s?\b", t): n.append("Moderada")
    if re.search(r"\b(sever[oa]s?|graves?)\b", t): n.append("Severa")
    return n[0] if len(n) == 1 else "Confirmar"


def cliente_y_lugar(titulo: str, lugar: str) -> str:
    """Cliente por defecto de la nota. Si el titulo es el lugar, no hay cliente por defecto."""
    t, l = norm(titulo), norm(lugar)
    if not l:
        return titulo.strip()
    if t == l or t in l:
        return ""
    if l in t:  # "Las Vizcachas Guido Sztyrle" -> "Guido Sztyrle"
        resto = re.sub(re.escape(lugar.strip()), "", titulo, flags=re.I).strip(" -,")
        return resto if len(norm(resto)) > 2 else ""
    return titulo.strip()


def procesar(seg: dict) -> list[dict]:
    lineas = [l.rstrip() for l in seg["texto"].splitlines()]
    lugar = ""
    for l in lineas:
        m = COMILLAS.match(l)
        if m:
            lugar = m.group(1).strip()
            break
    base = cliente_y_lugar(seg["titulo"], lugar)
    if not lugar:
        lugar = seg["titulo"].strip() if not base else ""
    fichas, cur, cliente, modo, previo_blanco = [], None, base, "atendido", True

    def cerrar():
        nonlocal cur
        if cur:
            cur["hallazgos"] = "; ".join(cur.pop("_lineas"))
            fichas.append(cur)
        cur = None

    for i, l in enumerate(lineas):
        t = l.strip()
        if not t:
            previo_blanco = True
            continue
        if re.fullmatch(r"[_\-=—–]{4,}", t) or COMILLAS.match(t):
            cerrar(); previo_blanco = False
            if COMILLAS.match(t):
                lugar = COMILLAS.match(t).group(1).strip()
            continue
        if CLIENTE.match(t):
            cerrar()
            cliente, modo, previo_blanco = CLIENTE.sub("", t).strip(" :"), "atendido", False
            continue
        siguiente = next((m.strip() for m in lineas[i + 1:] if m.strip()), "")
        es_bullet = bool(BULLET.match(t))
        nombre = BULLET.sub("", t).strip() if es_bullet else t
        # Encabezado: renglon suelto antes de caballos, o viñeta que termina en ":"
        encabezado = (not es_bullet and previo_blanco and BULLET.match(siguiente)) or (es_bullet and nombre.endswith(":") and len(nombre) < 30)
        if encabezado:
            cerrar()
            limpio = nombre.strip("():. ")
            if NO_ATENDIDOS.match(norm(limpio)):
                modo = "no"
            elif ROTULOS.match(norm(limpio)) or len(limpio) <= 1:
                modo = "atendido"
            else:
                modo, cliente = "atendido", limpio
            previo_blanco = False
            continue
        previo_blanco = False
        if es_bullet:
            cerrar()
            if modo == "no" or DOSIS.search(nombre):
                continue
            duda, detalle = [], ""
            m = re.match(r"^(.*?)[\s.]*\(([^)]*)\)\s*(.*)$", nombre)
            if m:
                nombre, detalle = (m.group(1) + " " + m.group(3)).strip(), m.group(2).strip()
                # Entre parentesis casi siempre va pelaje o pedigri: queda como detalle
            m = re.match(r"^(.+?)\s*:\s*(.+)$", nombre)  # "LC. Moenia: escalones severos"
            resto = ""
            if m:
                nombre, resto = m.group(1).strip(), m.group(2).strip()
            if not cliente:
                duda.append("Sin cliente: la nota es de un lugar y no dice de quién es.")
            cur = {"fecha": seg["fecha"], "lugar": lugar, "cliente": cliente, "caballo": nombre.strip(" .⁠●"),
                   "detalle": detalle, "nota_id": seg["nota"], "titulo_nota": seg["titulo"], "duda": duda,
                   "_lineas": [resto] if resto else []}
        elif cur:
            if DOSIS.search(t):
                continue
            cur["_lineas"].append(t)
    cerrar()
    for f in fichas:
        f["severidad"] = gravedad(f["hallazgos"]) if f["hallazgos"] else "Confirmar"
    return fichas


def main() -> None:
    segs = json.load(open(sys.argv[1], encoding="utf-8"))
    out = [f for s in segs for f in procesar(s)]
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(out)} fichas, {sum(1 for f in out if f['duda'])} con dudas -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
