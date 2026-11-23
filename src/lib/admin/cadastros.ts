import type { User } from "@supabase/supabase-js";
import { clienteSupabaseServico } from "@/lib/supabase/servidor";

/**
 * Visão do ADM sobre os cadastros: junta o Supabase Auth (confirmação do e-mail, senha
 * pendente, último acesso) com perfis, placas e pedidos de ativação pelo NFC.
 * Quem pediu a ativação e ainda não confirmou só existe no Auth (o perfil nasce na confirmação).
 */

export type SituacaoCadastro = "email_pendente" | "senha_pendente" | "concluido";

export type PlacaDoCadastro = { codigo: string; status: string; ativadaEm: string | null; atribuidaEm: string | null };

export type Cadastro = {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  papel: "admin" | "cliente" | null;
  situacao: SituacaoCadastro;
  criadoEm: string;
  confirmadoEm: string | null;
  ultimoAcesso: string | null;
  origem: string | null;
  placas: PlacaDoCadastro[];
  ativacoesPendentes: { codigo: string; empresa: string; criadaEm: string; expiraEm: string }[];
};

const PAGINA_AUTH = 1000;
const MAX_PAGINAS_AUTH = 10;

function situacaoDe(usuario: User): SituacaoCadastro {
  if (!usuario.email_confirmed_at) return "email_pendente";
  if (usuario.user_metadata?.senha_pendente === true) return "senha_pendente";
  return "concluido";
}

async function todosOsUsuarios(): Promise<User[]> {
  const servico = clienteSupabaseServico();
  const usuarios: User[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS_AUTH; pagina++) {
    const { data, error } = await servico.auth.admin.listUsers({ page: pagina, perPage: PAGINA_AUTH });
    if (error) throw new Error(`Falha ao listar usuários do Auth: ${error.code ?? error.status}`);
    usuarios.push(...data.users);
    if (data.users.length < PAGINA_AUTH) break;
  }
  return usuarios;
}

export async function listarCadastros(): Promise<Cadastro[]> {
  const servico = clienteSupabaseServico();
  const usuarios = await todosOsUsuarios();
  const ids = usuarios.map((u) => u.id);

  const [perfis, placas, pendentes] = await Promise.all([
    servico.from("perfis").select("id, nome, telefone, papel").in("id", ids),
    servico.from("placas").select("codigo, status, ativada_em, atribuida_em, dono_id").in("dono_id", ids),
    servico.from("speed_tag_ativacoes_pendentes")
      .select("email, nome, criada_em, expira_em, placa_id")
      .is("concluida_em", null).gt("expira_em", new Date().toISOString()),
  ]);
  if (perfis.error || placas.error) throw new Error("Falha ao carregar perfis e placas");
  // Sem a migração 0022 a tabela não existe: a lista funciona, só sem os pedidos pendentes.
  if (pendentes.error) console.error("[admin/cadastros] ativações pendentes", pendentes.error.code);

  const perfilPorId = new Map(perfis.data.map((p) => [p.id, p]));
  const placasPorDono = new Map<string, PlacaDoCadastro[]>();
  for (const p of placas.data) {
    if (!p.dono_id) continue;
    const lista = placasPorDono.get(p.dono_id) ?? [];
    lista.push({ codigo: p.codigo, status: p.status, ativadaEm: p.ativada_em, atribuidaEm: p.atribuida_em });
    placasPorDono.set(p.dono_id, lista);
  }
  const idsPlacasPendentes = [...new Set((pendentes.data ?? []).map((a) => a.placa_id))];
  const { data: placasPendentes } = idsPlacasPendentes.length
    ? await servico.from("placas").select("id, codigo").in("id", idsPlacasPendentes)
    : { data: [] as { id: string; codigo: string }[] };
  const codigoPorPlaca = new Map((placasPendentes ?? []).map((p) => [p.id, p.codigo]));
  const pendentesPorEmail = new Map<string, Cadastro["ativacoesPendentes"]>();
  for (const a of pendentes.data ?? []) {
    const lista = pendentesPorEmail.get(a.email) ?? [];
    lista.push({ codigo: codigoPorPlaca.get(a.placa_id) ?? "?", empresa: a.nome, criadaEm: a.criada_em, expiraEm: a.expira_em });
    pendentesPorEmail.set(a.email, lista);
  }

  return usuarios
    .filter((u) => !!u.email)
    .map((u) => {
      const perfil = perfilPorId.get(u.id);
      const email = u.email!.toLowerCase();
      const meta = u.user_metadata ?? {};
      return {
        id: u.id,
        email,
        nome: perfil?.nome ?? (typeof meta.nome === "string" ? meta.nome : typeof meta.name === "string" ? meta.name : null),
        telefone: perfil?.telefone ?? (typeof meta.telefone === "string" ? meta.telefone : null),
        papel: perfil?.papel ?? null,
        situacao: situacaoDe(u),
        criadoEm: u.created_at,
        confirmadoEm: u.email_confirmed_at ?? null,
        ultimoAcesso: u.last_sign_in_at ?? null,
        origem: typeof meta.origem_cadastro === "string" ? meta.origem_cadastro : null,
        placas: (placasPorDono.get(u.id) ?? []).sort((a, b) => (b.ativadaEm ?? "").localeCompare(a.ativadaEm ?? "")),
        ativacoesPendentes: pendentesPorEmail.get(email) ?? [],
      } satisfies Cadastro;
    })
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
