# Requisitos — Painel de Investimentos

Levantamento feito em 08/10/2026. Projeto pessoal, uso de uma pessoa só.

## Problema

A área de investimentos da XP é difícil de entender para quem está começando.
O painel deve reunir os ativos num só lugar, com visual claro, interativo e explicações simples.

## Contexto de uso

- Uso no PC e no celular desde o início (layout responsivo).
- Dados atualizados toda vez que o painel é aberto ou recarregado (F5).
- Usuário iniciante em investimentos: o painel deve explicar, não só mostrar números.

## Priorização (MoSCoW)

### Must have — sem isso o painel não serve

- **Login** só com a conta do dono (sem cadastro de outros usuários).
- **Cotações atualizadas** ao abrir ou recarregar: ações, FIIs, BDRs, ETFs, cripto, Tesouro Direto, câmbio e índices.
- **Carteira** com cadastro manual das compras (ativo, quantidade, preço, data) e cálculo de rendimento.
- **Responsivo**: funcionar bem no PC e no celular.
- **IA explicando cada ativo**: panorama de por que subiu ou caiu, baseado em fatos e fontes (construída depois das cotações).

### Should have — importante, logo depois

- **Lista de observação**: ativos que não estão na carteira, em seções que o usuário escolhe mostrar na tela principal.
- **Gráficos de histórico** com filtro de período.

### Could have — seria bom ter

- Chat com IA dentro do site, com limite de perguntas por dia.
- Seção "Explorar": tipos de ativo e exemplos, com explicação educativa e indicadores factuais.
- Alertas e trailing stop com regras definidas pelo usuário.
- Outros gráficos.

### Won't have — fora do escopo agora

- Várias contas de usuário (isso é coisa de produto, não de agora).
- Sinal de compra ou venda.
- Integração automática com a XP (não há API para pessoa física).

## Regras e restrições

- **Segurança**
  - Chaves de API nunca no código do navegador. Ficam em variáveis de ambiente, usadas só nas funções do servidor (Vercel Functions).
  - `.env` nunca vai para o repositório (protegido pelo `.gitignore`).
  - A IA recebe só dados públicos (ativo, variação, notícias). Nunca valores da carteira.
- **IA**
  - Explica fatos com fonte. Não faz previsão nem dá recomendação de compra ou venda.
- **Custos**
  - Só serviços gratuitos: Vercel (plano Hobby), APIs de dados grátis, IA com plano grátis (Gemini ou Groq).
  - O servidor guarda as respostas das APIs por alguns minutos (cache) para não estourar os limites grátis.
  - brapi (plano grátis): 15.000 pedidos/mês, 1 ativo por pedido, cotação com ~30 min de atraso, sem cartão.
    Decisão (16/10/2026): cache de 30 minutos na função do servidor. Ações e FIIs aparecem com ~30 min de atraso;
    dólar e cripto vêm de APIs mais rápidas.
- **Limitações**
  - CDB, LCI, fundos e previdência não têm API grátis. Se entrarem, o cadastro e a atualização são manuais.
  - Supabase grátis pausa o projeto após ~1 semana sem uso; reativar em "Restore" no painel (os dados não somem).

## Fontes de dados

| Dado | API |
|---|---|
| Ações, FIIs, BDRs, ETFs | brapi.dev (precisa de chave grátis) |
| Cripto | CoinGecko |
| Tesouro Direto | Tesouro Transparente |
| Câmbio | AwesomeAPI |

## Decisões tomadas

- **Login (27/10/2026):** por enquanto, o site inteiro (inclusive `/api`) fica protegido pela
  Vercel Authentication ("All Deployments"): só entra quem estiver logado na conta da Vercel do dono.
  Na fase do banco de dados, avaliar um serviço que traga banco + login juntos (ex.: Supabase).

- **Banco de dados (28/10/2026):** Supabase (PostgreSQL), plano grátis, região EUA (perto das funções da Vercel).
  Tabela `operacoes`: cada compra ou venda é uma linha; posições e preço médio são calculados.
  Esquema registrado em `db/schema.sql`. RLS ligado: só a função do servidor acessa, com a chave secreta.

## Decisões em aberto

- Se o login migra da Vercel Authentication para o Supabase Auth (só se houver várias contas).
- Formato da explicação da IA e qual fonte de notícias usar.
- Quais gráficos e quais períodos.
