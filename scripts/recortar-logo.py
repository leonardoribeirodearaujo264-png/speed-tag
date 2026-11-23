"""Recorta a logo azul da Speed Tag do fundo azul-marinho.

Alfa pelo canal mais forte (o fundo é escuro); depois só mantém pixels fracos
(bordas suaves) que estejam a poucos pixels de um pixel forte do desenho. Isso
remove o brilho do fundo e restos do círculo sem serrilhar as bordas.
Uso: python -I recortar_logo.py <entrada> <saida_logo> <saida_simbolo>
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

entrada, saida_logo, saida_simbolo = sys.argv[1:4]
original = Image.open(entrada).convert("RGB")


FUNDO = np.array([2, 6, 28], dtype=np.float32)  # azul-marinho medido atrás da logo


def recortar(caixa, limiar=55, cheio=165, forte=170, raio=5):
    img = np.asarray(original.crop(caixa)).astype(np.float32)
    m = img.max(axis=2)
    # Distância até o fundo: cinza e branco do S contam como opacos, não só o canal mais forte.
    dist = np.abs(img - FUNDO).max(axis=2)
    alfa = np.clip((dist - limiar) * 255 / (cheio - limiar), 0, 255)
    nucleo = Image.fromarray((dist >= forte).astype(np.uint8) * 255)
    perto = np.asarray(nucleo.filter(ImageFilter.MaxFilter(raio * 2 + 1))) > 0
    alfa = np.where(perto, alfa, 0)
    cor = np.where(m[..., None] > 0, np.clip(img * 255 / np.maximum(m, 1)[..., None], 0, 255), 0)
    # Mantém o brilho original onde é opaco; despremultiplica só a borda.
    cor = np.where(alfa[..., None] >= 250, img, cor)
    rgba = np.dstack([cor, alfa]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


# Logo completa: "S / SPEED TAG", sem o círculo.
logo = recortar((60, 460, 1180, 780))
a = np.asarray(logo).copy()
a[200:, :24, 3] = 0  # pedaço do círculo da arte no canto inferior esquerdo
logo = Image.fromarray(a, "RGBA")
logo = logo.crop(logo.getbbox())
logo.save(saida_logo, optimize=True)

# Só o S: apaga a barra diagonal (linha de (598,465) a (500,770) na arte original).
simbolo = recortar((65, 465, 565, 727))
a = np.asarray(simbolo).copy()
ys, xs = np.mgrid[0 : a.shape[0], 0 : a.shape[1]]
limite = (598 - 65) - (ys * 98 / 305) - 8
a[..., 3] = np.where(xs > limite, 0, a[..., 3])
simbolo = Image.fromarray(a, "RGBA")
simbolo = simbolo.crop(simbolo.getbbox())
lado = int(max(simbolo.size) * 1.08)
quadro = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
quadro.paste(simbolo, ((lado - simbolo.width) // 2, (lado - simbolo.height) // 2), simbolo)
quadro.resize((512, 512), Image.LANCZOS).save(saida_simbolo, optimize=True)
print("logo", logo.size, "simbolo 512x512")
