/**
 * Tipos do banco escritos à mão a partir de supabase/migrations.
 * Quando o projeto Supabase existir, substituir pelo gerado:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/tipos.ts
 */
export type Json = string | number | boolean | null | { [chave: string]: Json | undefined } | Json[];

export type StatusPlaca = "disponivel" | "reservada" | "atribuida" | "ativa" | "desativada";
export type OrigemEmpresa = "google_places" | "manual";
export type OrigemLeitura = "nfc" | "qr" | "desconhecida";
export type PapelUsuario = "cliente" | "admin";
export type AcaoHistorico =
  | "criou"
  | "gravou_nfc"
  | "travou_nfc"
  | "ativou"
  | "trocou_destino"
  | "bloqueou"
  | "desbloqueou"
  | "resetou"
  | "reivindicou"
  | "reservou"
  | "atribuiu"
  | "liberou"
  | "desativou"
  | "reativou"
  | "tentativa_negada"
  | "editou_empresa"
  | "transferiu"
  | "mudou_lote";

type Tabela<Row, Obrigatorios extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Obrigatorios> & Partial<Omit<Row, Obrigatorios>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Perfil = {
  grupo_cliente: "revendedor" | "comprador" | null;
  id: string;
  nome: string | null;
  email: string | null;
  papel: PapelUsuario;
  solicitou_admin_em: string | null;
  admin_recusado_em: string | null;
  bloqueado_em: string | null;
  limite_placas: number | null;
  telefone: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Lote = {
  id: string;
  nome: string;
  quantidade: number;
  revendedor: string | null;
  criado_por: string | null;
  criado_em: string;
  /** Modelo da arte impressa: ver src/lib/placas/modelos-arte.ts. */
  modelo_arte: "azul" | "preta";
};

export type Empresa = {
  email_contato: string | null;
  id: string;
  dono_id: string | null;
  origem: OrigemEmpresa;
  google_place_id: string | null;
  nome: string;
  link_avaliacao: string;
  criado_em: string;
  atualizado_em: string;
};

export type Placa = {
  id: string;
  codigo: string;
  lote_id: string | null;
  status: StatusPlaca;
  empresa_id: string | null;
  dono_id: string | null;
  destino_url: string | null;
  email_ativacao: string | null;
  criada_por: string | null;
  nfc_gravado_em: string | null;
  preparada_nfc: boolean;
  nfc_testada_em: string | null;
  nfc_entregue_em: string | null;
  nfc_travado: boolean;
  ativada_em: string | null;
  reservada_para: string | null;
  atribuida_em: string | null;
  criado_em: string;
  atualizado_em: string;
  /** Cor da arte desta placa; null = vale a cor do lote (migração 0026). */
  modelo_arte?: "azul" | "preta" | null;
};

export type Leitura = {
  id: number;
  placa_id: string;
  ocorrida_em: string;
  origem: OrigemLeitura;
  dispositivo: "mobile" | "desktop" | "outro" | null;
  pais: string | null;
};

export type HistoricoPlaca = {
  id: number;
  placa_id: string;
  acao: AcaoHistorico;
  antes: Json | null;
  depois: Json | null;
  ator_id: string | null;
  criado_em: string;
};

export type AcessoInvalido = {
  id: number;
  codigo_tentado: string;
  ocorrida_em: string;
  dispositivo: "mobile" | "desktop" | "outro" | null;
  pais: string | null;
};

export type ErroAtivacao = "NAO_AUTENTICADO" | "DADOS_INVALIDOS" | "NAO_ENCONTRADA" | "NAO_E_SUA" | "DESATIVADA" | "JA_ATIVADA";

export type ResultadoAtivacao =
  | { ok: true; placa_id: string; empresa_id: string; destino_url: string }
  | { ok: false; erro: ErroAtivacao; campo?: string };

export type ResultadoTrocaDestino =
  | { ok: true; empresa_id: string; destino_url: string }
  | {
      ok: false;
      erro: "NAO_AUTENTICADO" | "DADOS_INVALIDOS" | "NAO_ENCONTRADA" | "PLACA_NAO_ATIVA";
      campo?: string;
    };

export type EstatisticasAdmin = {
  placas: {
    total: number;
    disponiveis: number;
    reservadas: number;
    atribuidas: number;
    ativas: number;
    desativadas: number;
    nfc_pendente: number;
  };
  usuarios: number;
  empresas: number;
  clientes: number;
  pedidos_admin: number;
  leituras_periodo: number;
  serie: Array<{ dia: string; nfc: number; qr: number }>;
  top_placas: Array<{ codigo: string; empresa: string | null; leituras: number }>;
};

export type ResultadoAtualizarUsuario =
  | { ok: true }
  | { ok: false; erro: "NOME_LONGO" | "TELEFONE_INVALIDO" | "NAO_ENCONTRADO" | "PROPRIO_USUARIO" };

export type StatusSolicitacaoAdmin = "ADMIN" | "PENDENTE" | "RECUSADO";

export type ResultadoDefinirAdmin =
  | { ok: true; usuario_id: string }
  | { ok: false; erro: "NAO_ENCONTRADO" | "PROPRIO_USUARIO" };

export type AtivacaoPendente = {
  id: string;
  placa_id: string;
  email: string;
  conta_nova: boolean;
  origem: OrigemEmpresa;
  place_id: string | null;
  nome: string;
  link: string;
  criada_em: string;
  expira_em: string;
  concluida_em: string | null;
  usuario_id: string | null;
  resultado: string | null;
};

export type ResultadoConclusaoAtivacoes = { ativadas: string[]; recusadas: string[] };

export type Database = {
  public: {
    Tables: {
      perfis: Tabela<Perfil, "id">;
      lotes: Tabela<Lote, "nome" | "quantidade">;
      empresas: Tabela<Empresa, "origem" | "nome" | "link_avaliacao">;
      placas: Tabela<Placa, "codigo">;
      leituras: Tabela<Leitura, "placa_id" | "origem">;
      historico_placa: Tabela<HistoricoPlaca, "placa_id" | "acao">;
      acessos_invalidos: Tabela<AcessoInvalido, "codigo_tentado">;
      speed_tag_ativacoes_pendentes: Tabela<AtivacaoPendente, "placa_id" | "email" | "conta_nova" | "origem" | "nome" | "link">;
    };
    Views: { [_ in never]: never };
    Functions: {
      speed_tag_cadastrar_empresa: { Args: { p_dono: string; p_nome: string; p_email: string; p_link: string | null }; Returns: string };
      speed_tag_editar_empresa: { Args: { p_empresa: string; p_nome: string; p_email: string | null; p_link: string | null }; Returns: boolean };
      speed_tag_editar_empresa_completa: { Args: { p_empresa: string; p_nome: string; p_email: string | null; p_link: string | null }; Returns: boolean };
      speed_tag_remover_placa_da_empresa: { Args: { p_empresa: string; p_codigo: string }; Returns: boolean };
      speed_tag_acessos_empresas: { Args: { p_empresas: string[] }; Returns: { empresa_id: string; acessos: number }[] };
      speed_tag_gerenciar_empresa_cliente: { Args: { p_empresa: string; p_link: string | null }; Returns: boolean };
      speed_tag_vincular_empresa: { Args: { p_empresa: string; p_codigo: string }; Returns: boolean };
      speed_tag_editar_cliente_grupo: {
        Args: { p_usuario: string; p_nome: string | null; p_telefone: string | null; p_bloqueado: boolean; p_limite: number | null; p_grupo: Perfil["grupo_cliente"] };
        Returns: Json;
      };
      speed_tag_contar_placas_clientes: { Args: { p_usuarios: string[] }; Returns: { usuario_id: string; total: number }[] };
      speed_tag_remover_acesso_cliente: { Args: { p_usuario: string }; Returns: boolean };
      speed_tag_acesso_cliente: { Args: Record<string, never>; Returns: boolean };
      speed_tag_renomear_empresa: { Args: { p_empresa: string; p_nome: string }; Returns: boolean };
      speed_tag_editar_cliente: {
        Args: { p_usuario: string; p_nome: string | null; p_telefone: string | null; p_bloqueado: boolean; p_limite: number | null };
        Returns: Json;
      };
      speed_tag_admin_transferir: { Args: { p_codigo: string; p_usuario: string }; Returns: boolean };
      speed_tag_reivindicar_nfc: { Args: { p_codigo: string; p_hash: string | null }; Returns: boolean };
      placas_preparar_nfc: { Args: { p_codigo: string }; Returns: string };
      placas_etapa_nfc: {
        Args: { p_codigo: string; p_etapa: string; p_hash: string | null };
        Returns: boolean;
      };
      placas_consultar_nfc: {
        Args: { p_codigo: string; p_ator: string; p_hash: string | null };
        Returns: "ok" | "negada" | "aguarde";
      };
      placas_ativar_nfc: {
        Args: {
          p_codigo: string;
          p_ator: string;
          p_hash: string | null;
          p_place_id: string;
          p_nome: string;
          p_link: string;
        };
        Returns: boolean;
      };
      normalizar_codigo: { Args: { p_codigo: string }; Returns: string };
      link_avaliacao_valido: { Args: { p_link: string }; Returns: boolean };
      eh_admin: { Args: Record<string, never>; Returns: boolean };
      ativar_placa: {
        Args: {
          p_codigo: string;
          p_origem: OrigemEmpresa;
          p_place_id: string | null;
          p_nome: string;
          p_link: string;
          p_ator: string;
        };
        Returns: Json;
      };
      registrar_leitura: {
        Args: {
          p_placa_id: string;
          p_origem: OrigemLeitura;
          p_dispositivo?: string | null;
          p_pais?: string | null;
        };
        Returns: undefined;
      };
      trocar_destino: {
        Args: {
          p_placa_id: string;
          p_origem: OrigemEmpresa;
          p_place_id: string | null;
          p_nome: string;
          p_link: string;
        };
        Returns: Json;
      };
      reivindicar_placas: { Args: Record<string, never>; Returns: number };
      garantir_perfil: { Args: Record<string, never>; Returns: undefined };
      definir_admin: { Args: { p_email: string; p_admin: boolean }; Returns: Json };
      admin_atribuir_placas: { Args: { p_codigos: string[]; p_usuario: string }; Returns: Json };
      admin_atribuir_do_lote: { Args: { p_lote: string; p_usuario: string; p_quantidade: number }; Returns: Json };
      admin_reservar_placa: { Args: { p_placa: string; p_nota: string }; Returns: Json };
      admin_liberar_placa: { Args: { p_placa: string }; Returns: Json };
      admin_desativar_placa: { Args: { p_placa: string; p_motivo: string | null }; Returns: Json };
      admin_reativar_placa: { Args: { p_placa: string }; Returns: Json };
      admin_transferir_placas: { Args: { p_codigos: string[]; p_usuario: string }; Returns: Json };
      admin_mover_lote: { Args: { p_codigos: string[]; p_lote: string | null }; Returns: Json };
      speed_tag_excluir_lote: { Args: { p_lote: string }; Returns: Json };
      email_tem_conta: { Args: { p_email: string }; Returns: boolean };
      consumir_cota_google: { Args: { p_chave: string; p_limite: number; p_janela_segundos: number }; Returns: boolean };
      usuario_por_email: { Args: { p_email: string }; Returns: string | null };
      speed_tag_registrar_envio: { Args: { p_email: string; p_tipo: string; p_limite: number; p_janela_minutos: number }; Returns: boolean };
      speed_tag_concluir_ativacoes: { Args: Record<string, never>; Returns: Json };
      speed_tag_definir_cor_placas: { Args: { p_codigos: string[]; p_modelo: string | null }; Returns: number };
      ativar_placa_cliente: {
        Args: { p_codigo: string; p_ator: string; p_origem: OrigemEmpresa; p_place_id: string | null; p_nome: string; p_link: string };
        Returns: Json;
      };
      registrar_acesso_invalido: { Args: { p_codigo: string; p_dispositivo?: string | null; p_pais?: string | null }; Returns: undefined };
      resumo_redirecionamento: {
        Args: { p_codigo: string };
        Returns: Array<{ id: string; codigo: string; situacao: StatusPlaca; destino_url: string | null }>;
      };
      solicitar_admin: { Args: Record<string, never>; Returns: StatusSolicitacaoAdmin };
      recusar_solicitacao_admin: { Args: { p_usuario: string }; Returns: undefined };
      estatisticas_admin: { Args: { p_dias?: number }; Returns: Json };
      admin_atualizar_usuario: {
        Args: { p_usuario: string; p_nome: string | null; p_telefone: string | null; p_papel: PapelUsuario; p_bloqueado: boolean };
        Returns: Json;
      };
      criar_placas: {
        Args: { p_codigos: string[]; p_lote_id?: string | null };
        Returns: Placa[];
      };
      criar_lote: {
        Args: { p_nome: string; p_codigos: string[]; p_revendedor?: string | null };
        Returns: string;
      };
      registrar_nfc: {
        Args: { p_placa_id: string; p_travado?: boolean };
        Returns: Placa;
      };
    };
    Enums: {
      status_placa: StatusPlaca;
      origem_empresa: OrigemEmpresa;
      origem_leitura: OrigemLeitura;
      papel_usuario: PapelUsuario;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
