"""Cria placas de exemplo no Supabase para ver o painel com dados.

Tudo fica no lote "Exemplos (pode apagar)": apagar o lote e as placas dele remove
leituras e histórico juntos (on delete cascade). Usa a SUPABASE_SECRET_KEY do
.env.local (só no servidor; nunca imprime a chave).
Uso: python -I scripts/criar-exemplos.py   (rodar na pasta do projeto)
"""
import json
import random
import secrets
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
NOME_LOTE = "Exemplos (pode apagar)"

env = {
    chave.strip(): valor.strip()
    for chave, valor in (
        linha.split("=", 1)
        for linha in Path(".env.local").read_text(encoding="utf-8").splitlines()
        if "=" in linha and not linha.lstrip().startswith("#")
    )
}
URL = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
CHAVE = env["SUPABASE_SECRET_KEY"]


def api(metodo: str, caminho: str, corpo=None):
    dados = None if corpo is None else json.dumps(corpo).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/{caminho}",
        data=dados,
        method=metodo,
        headers={
            "apikey": CHAVE,
            "Authorization": f"Bearer {CHAVE}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto else None
    except urllib.error.HTTPError as erro:
        raise SystemExit(f"{metodo} {caminho.split('?')[0]} falhou: HTTP {erro.code} {erro.read().decode()[:300]}")


if api("GET", f"lotes?select=id&nome=eq.{urllib.request.quote(NOME_LOTE)}"):
    raise SystemExit("O lote de exemplos já existe; nada foi criado.")

codigo = lambda: "".join(ALFABETO[b % 32] for b in secrets.token_bytes(6))  # noqa: E731
agora = datetime.now(timezone.utc)

lote = api("POST", "lotes", {"nome": NOME_LOTE, "quantidade": 8})[0]

empresas_exemplo = [
    "Exemplo: Barbearia Central",
    "Exemplo: Padaria Bom Dia",
    "Exemplo: Pet Shop Amigo Fiel",
    "Exemplo: Oficina Rápida",
]
empresas = api(
    "POST",
    "empresas",
    [
        {
            "origem": "manual",
            "nome": nome,
            "link_avaliacao": f"https://search.google.com/local/writereview?placeid=EXEMPLO-{i + 1}",
        }
        for i, nome in enumerate(empresas_exemplo)
    ],
)

placas_corpo = []
for i in range(8):
    criada = agora - timedelta(days=40 - i)
    # Inserção em lote do PostgREST exige as mesmas chaves em todas as linhas.
    item = {
        "codigo": codigo(),
        "lote_id": lote["id"],
        "criado_em": criada.isoformat(),
        "status": "nao_ativada",
        "empresa_id": None,
        "destino_url": None,
        "ativada_em": None,
        "nfc_gravado_em": None,
        "nfc_travado": False,
    }
    if i < 4:  # ativas, com empresa e NFC gravado
        item.update(
            status="ativa",
            empresa_id=empresas[i]["id"],
            destino_url=empresas[i]["link_avaliacao"],
            ativada_em=(criada + timedelta(days=2)).isoformat(),
            nfc_gravado_em=(criada + timedelta(hours=3)).isoformat(),
            nfc_travado=i % 2 == 0,
        )
    elif i == 7:
        item["status"] = "bloqueada"
    placas_corpo.append(item)
placas = api("POST", "placas", placas_corpo)

historico = []
for p in placas:
    historico.append({"placa_id": p["id"], "acao": "criou", "criado_em": p["criado_em"], "depois": {"lote_id": lote["id"]}})
    if p["status"] == "ativa":
        historico.append({"placa_id": p["id"], "acao": "ativou", "criado_em": p["ativada_em"], "depois": {"status": "ativa"}})
    if p["status"] == "bloqueada":
        historico.append({"placa_id": p["id"], "acao": "bloqueou", "criado_em": p["criado_em"], "depois": {"status": "bloqueada"}})
api("POST", "historico_placa", historico)

# Leituras dos últimos 30 dias nas placas ativas, com mais movimento nos fins de semana.
random.seed(23)
leituras = []
for peso, p in zip((5, 3, 2, 1), [p for p in placas if p["status"] == "ativa"]):
    for d in range(30):
        dia = agora - timedelta(days=d)
        quantidade = random.randint(0, peso + (2 if dia.weekday() >= 5 else 0))
        for _ in range(quantidade):
            momento = dia.replace(hour=random.randint(9, 21), minute=random.randint(0, 59))
            leituras.append(
                {
                    "placa_id": p["id"],
                    "ocorrida_em": momento.isoformat(),
                    "origem": "nfc" if random.random() < 0.7 else "qr",
                    "dispositivo": "mobile",
                    "pais": "BR",
                }
            )
for inicio in range(0, len(leituras), 500):
    api("POST", "leituras", leituras[inicio : inicio + 500])

print(f"Lote criado com {len(placas)} placas, {len(empresas)} empresas e {len(leituras)} leituras.")
print("Códigos:", ", ".join(p["codigo"] for p in placas))
