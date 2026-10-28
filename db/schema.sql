-- =========================================================
-- ESQUEMA DO BANCO (Supabase / PostgreSQL)
-- "Planta" do banco: registra como as tabelas foram criadas.
-- Para recriar o banco do zero, rode este arquivo no SQL Editor do Supabase.
-- =========================================================

-- Tabela de operações da carteira: cada compra ou venda é uma linha.
-- As posições (quantidade total, preço médio) são CALCULADAS a partir daqui.
create table operacoes (
  id bigint generated always as identity primary key,
  tipo_operacao text not null check (tipo_operacao in ('compra', 'venda')),
  ativo text not null check (char_length(ativo) between 1 and 40),
  tipo_ativo text not null check (tipo_ativo in ('Ação', 'FII', 'ETF', 'BDR', 'Cripto', 'Tesouro Direto', 'Outro')),
  quantidade numeric not null check (quantidade > 0),
  preco_unitario numeric not null check (preco_unitario >= 0),
  taxas numeric not null default 0 check (taxas >= 0),
  corretora text check (char_length(corretora) <= 40),
  data_operacao date not null,
  criado_em timestamptz not null default now()
);

-- Segurança: a tabela nasce trancada (ninguém lê nem escreve pelo acesso público).
-- Só a função do servidor (api/operacoes.js), com a chave secreta, consegue acessar.
alter table operacoes enable row level security;
