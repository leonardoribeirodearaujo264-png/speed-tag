"""Recorta a arte enviada pelo cliente (foto do cartão com sombra) no limite do cartão
e amplia para 2000 x 2000 px, o tamanho do PNG de impressão.

Uso: python scripts/preparar-arte-cliente.py <imagem> <saida.jpg> <esq> <topo> <dir> <base>
As coordenadas são as bordas internas do cartão na imagem original.
"""
import sys
from PIL import Image, ImageFilter

origem, saida = sys.argv[1], sys.argv[2]
esq, topo, dir_, base = (int(v) for v in sys.argv[3:7])
im = Image.open(origem).convert("RGB").crop((esq, topo, dir_, base))
im = im.resize((2000, 2000), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
im.save(saida, "JPEG", quality=92, optimize=True, progressive=True)
print(saida, im.size)
