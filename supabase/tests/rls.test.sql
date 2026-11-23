-- Testes de banco com pgTAP. Rodar com: supabase test db
-- Cobrem RLS (cliente não vê placa de outro, não se promove a admin, anon não lê nada)
-- e a ativação atômica.
begin;
select plan(28);

-- Usuários de teste (o gatilho cria os perfis).
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'ana@teste.dev', now(), '{}'),
  ('22222222-2222-4222-8222-222222222222', 'bia@teste.dev', now(), '{}'),
  ('33333333-3333-4333-8333-333333333333', 'adm@teste.dev', now(), '{}');
insert into public.speed_tag_administradores (usuario_id)
values ('33333333-3333-4333-8333-333333333333')
on conflict (usuario_id) do nothing;
update public.perfis set papel = 'admin' where id = '33333333-3333-4333-8333-333333333333';

-- Placas em estoque; TST001 e TST002 atribuídas à Ana (o admin faria isso pelo painel).
insert into public.placas (codigo, status, dono_id) values
  ('TST001', 'atribuida', '11111111-1111-4111-8111-111111111111'),
  ('TST002', 'atribuida', '11111111-1111-4111-8111-111111111111'),
  ('TST003', 'disponivel', null);

-- Ativação pela rota do servidor (service_role), sempre com o usuário logado em p_ator.
select is(
  (public.ativar_placa('tst001', 'manual', null, 'Loja da Ana',
    'https://g.page/r/loja-ana/review', '11111111-1111-4111-8111-111111111111') ->> 'ok'),
  'true', 'dona ativa a placa atribuída (código normalizado)'
);
select is(
  (public.ativar_placa('TST001', 'manual', null, 'Outra',
    'https://g.page/r/outra/review', '11111111-1111-4111-8111-111111111111') ->> 'erro'),
  'JA_ATIVADA', 'segunda ativação é recusada'
);
select is(
  (public.ativar_placa('TST002', 'manual', null, 'Golpe',
    'https://site-falso.com/review', '11111111-1111-4111-8111-111111111111') ->> 'erro'),
  'DADOS_INVALIDOS', 'link fora do Google é recusado'
);
select is(
  (public.ativar_placa('TST003', 'manual', null, 'X',
    'https://g.page/r/x/review', '22222222-2222-4222-8222-222222222222') ->> 'erro'),
  'NAO_E_SUA', 'placa em estoque não é ativada por quem não a recebeu'
);
select is(
  (select count(*) from public.historico_placa h join public.placas p on p.id = h.placa_id
   where p.codigo = 'TST003' and h.acao = 'tentativa_negada')::int,
  1, 'tentativa negada fica registrada'
);

-- Cliente Ana
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is((select count(*) from public.placas)::int, 2, 'Ana vê só as placas dela');
select throws_ok(
  $$ update public.perfis set papel = 'admin' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'Ana não consegue se promover a admin'
);
select is(
  (select count(*) from (
    update public.placas set destino_url = 'https://site-falso.com' returning 1
  ) t)::int,
  0, 'Ana não altera placa por UPDATE direto'
);
select throws_ok(
  $$ select public.ativar_placa('TST003', 'manual', null, 'X', 'https://g.page/r/x/review', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'cliente não chama ativar_placa direto'
);
select is(
  (public.trocar_destino(
    (select id from public.placas where codigo = 'TST001'),
    'manual', null, 'Loja da Ana Nova', 'https://g.page/r/loja-ana-nova/review'
  ) ->> 'ok'),
  'true', 'dona troca o destino pela função'
);

-- Cliente Bia
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*) from public.placas)::int, 0, 'Bia não vê placas da Ana');
select is(
  (public.trocar_destino(
    '00000000-0000-4000-8000-0000000000ff',
    'manual', null, 'Invasão', 'https://g.page/r/invasao/review'
  ) ->> 'erro'),
  'NAO_ENCONTRADA', 'Bia não troca destino de placa que não é dela'
);

-- Anônimo
reset role;
set local role anon;
select throws_ok($$ select * from public.placas $$, '42501', null, 'anon não lê placas');

-- Admin
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select ok((select count(*) from public.placas) >= 3, 'admin vê todas as placas');

-- Etapa 2: criação e NFC
select is(
  (select count(*) from public.criar_placas(array['NV0001', 'NV0002']))::int,
  2, 'admin cria placas e recebe as criadas'
);
select throws_ok(
  $$ select public.criar_placas(array['NV0003', 'NV0001']) $$,
  '23505', null, 'código já existente aborta a criação inteira (COLISAO_CODIGO)'
);
select is(
  (select count(*) from public.placas where codigo = 'NV0003')::int,
  0, 'nada fica gravado depois da colisão'
);
select is(
  (public.registrar_nfc((select id from public.placas where codigo = 'NV0001'), true)).nfc_travado,
  true, 'admin registra NFC gravado e travado'
);

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.criar_placas(array['NV0009']) $$,
  '42501', null, 'cliente não cria placa'
);

select is(public.eh_admin(), false, 'cliente não tem acesso administrativo');
select throws_ok(
  $$ select public.speed_tag_editar_cliente('11111111-1111-4111-8111-111111111111', 'Ana', null, false, 100) $$,
  '42501', null, 'cliente não altera o limite da própria conta'
);
select is(public.speed_tag_criar_placa_propria('NV0010'), false, 'cadastro de tag própria exige limite configurado');
select is(public.speed_tag_reivindicar_nfc('NV0001', repeat('a', 64)), false, 'código público não vincula tag sem entrega e segredo');
select ok(
  public.speed_tag_cadastrar_empresa('11111111-1111-4111-8111-111111111111',
    'Empresa própria de teste', 'ana@teste.dev', 'https://g.page/r/teste/review') is not null,
  'cliente cadastra empresa na própria conta'
);
select throws_ok(
  $$ select public.speed_tag_cadastrar_empresa('22222222-2222-4222-8222-222222222222',
    'Outra empresa', 'bia@teste.dev', null) $$,
  '42501', null, 'cliente não cadastra empresa para outra conta'
);
select is(
  public.speed_tag_vincular_empresa((select id from public.empresas where nome = 'Empresa própria de teste'), 'TST001'),
  true, 'cliente vincula uma placa própria à sua empresa'
);

reset role;
insert into public.speed_tag_administradores (usuario_id) values ('22222222-2222-4222-8222-222222222222');
update public.perfis set papel = 'admin' where id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select ok(public.eh_admin(), 'segunda conta autorizada também é administradora');
select is(
  public.speed_tag_editar_cliente('33333333-3333-4333-8333-333333333333', 'Admin', null, false, null) ->> 'ok',
  'true', 'administrador pode editar outro administrador preservando seu papel'
);

select * from finish();
rollback;
