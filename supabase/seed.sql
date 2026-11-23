-- Dados de desenvolvimento. Roda em `supabase db reset` (nunca em produção).
-- Admin de teste: crie o usuário pelo Auth (link mágico) e depois rode:
--   begin;
--   insert into public.speed_tag_administradores (usuario_id)
--     select id from public.perfis where email = '<seu e-mail>';
--   update public.perfis set papel = 'admin' where email = '<seu e-mail>';
--   commit;

insert into public.lotes (id, nome, quantidade)
values ('00000000-0000-4000-8000-000000000001', 'Lote de desenvolvimento', 5);

insert into public.placas (codigo, lote_id) values
  ('A1B2C3', '00000000-0000-4000-8000-000000000001'),
  ('D4E5F6', '00000000-0000-4000-8000-000000000001'),
  ('G7H8J9', '00000000-0000-4000-8000-000000000001'),
  ('K2M3N4', '00000000-0000-4000-8000-000000000001');

-- Uma placa já ativada (manual) e outra bloqueada, para testar /t/[codigo].
insert into public.empresas (id, origem, nome, link_avaliacao)
values (
  '00000000-0000-4000-8000-000000000002',
  'manual',
  'Empresa de Teste',
  'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
);

insert into public.placas (codigo, lote_id, status, empresa_id, destino_url, ativada_em)
values (
  'P5Q6R7',
  '00000000-0000-4000-8000-000000000001',
  'ativa',
  '00000000-0000-4000-8000-000000000002',
  'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
  now()
);

update public.placas set status = 'desativada' where codigo = 'K2M3N4';
