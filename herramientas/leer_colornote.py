"""Descifra un respaldo de ColorNote (.backup) y lo guarda como JSON, sin modificar el original.

Uso:
    python herramientas/leer_colornote.py datos/colornote-AAAAMMDD.backup [PIN]

El PIN por defecto de ColorNote es 0000. El resultado queda en datos/ (no se sube a GitHub).
Mismo formato que docs/colornote.js: 28 bytes de cabecera + AES-128-CBC,
clave = MD5(PIN + "ColorNote Fixed Salt"), IV en cero.
"""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def descifrar(datos: bytes, pin: str) -> bytes:
    clave = hashlib.md5((pin + "ColorNote Fixed Salt").encode()).digest()
    cuerpo = datos[28:]
    cuerpo = cuerpo[: len(cuerpo) - len(cuerpo) % 16]
    d = Cipher(algorithms.AES(clave), modes.CBC(bytes(16))).decryptor()
    return d.update(cuerpo) + d.finalize()


def registros(plano: bytes) -> list[dict]:
    out, i = [], 0
    while i + 8 <= len(plano):
        cant = struct.unpack(">I", plano[i + 4 : i + 8])[0]
        i += 8
        if cant > 1_000_000:
            break
        for _ in range(cant):
            if i + 4 > len(plano):
                return out
            largo = struct.unpack(">I", plano[i : i + 4])[0]
            i += 4
            try:
                out.append(json.loads(plano[i : i + largo].decode("utf-8")))
            except (ValueError, UnicodeDecodeError):
                pass
            i += largo
    return out


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    origen = Path(sys.argv[1])
    regs = registros(descifrar(origen.read_bytes(), sys.argv[2] if len(sys.argv) > 2 else "0000"))
    notas = [r for r in regs if isinstance(r, dict) and ("note" in r or "title" in r) and not r.get("auth_token")]
    if not notas:
        sys.exit("No encontré notas: revisá el PIN de ColorNote.")
    destino = origen.with_suffix(".notas.json")
    destino.write_text(json.dumps(notas, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(notas)} notas -> {destino}")


if __name__ == "__main__":
    main()
