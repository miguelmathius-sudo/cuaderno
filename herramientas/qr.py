"""Muestra un codigo QR en la terminal y lo guarda como imagen, para abrir un link con la camara del celular.

Uso:
    python herramientas/qr.py https://usuario.github.io/cuaderno/

Necesita la libreria qrcode:  python -m pip install "qrcode[pil]"
"""
import sys

try:
    import qrcode
except ImportError:
    sys.exit('Falta la libreria. Instalala con:  python -m pip install "qrcode[pil]"')

if len(sys.argv) < 2:
    sys.exit(__doc__)

url = sys.argv[1]
qr = qrcode.QRCode(border=2)
qr.add_data(url)
qr.make(fit=True)
qr.print_ascii(invert=True)
try:
    qr.make_image().save("qr-cuaderno.png")
    print("\nTambien lo guarde como qr-cuaderno.png")
except Exception:
    pass
print(f"\nLink: {url}")
