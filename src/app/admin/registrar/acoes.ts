"use server";

export type EstadoRegistro =
  | { tipo: "inicial" }
  | { tipo: "confirmar_email"; email: string }
  | { tipo: "erro"; mensagem: string; campos: { nome: string; email: string } };

export async function registrarAdmin(_anterior: EstadoRegistro, _dados: FormData): Promise<EstadoRegistro> {
  void _anterior;
  void _dados;
  return { tipo: "erro", mensagem: "Use a área do cliente para criar sua conta.", campos: { nome: "", email: "" } };
}
