// =========================================================
// API: COTAÇÃO DE UM ATIVO DA B3 (ação, FII, ETF, BDR)
// Roda no servidor da Vercel, NÃO no navegador.
// Uso: /api/cotacao?ativo=PETR4  (ou um índice: ?ativo=^BVSP)
// =========================================================

// Responde com um erro em JSON, sempre no mesmo formato: { erro: "..." }
// cachear = true: guarda o erro por 30 min (ex.: ativo que não existe no plano grátis),
// para não gastar consulta da brapi perguntando a mesma coisa a cada F5
function responderErro(mensagem, status, cachear = false) {
    const headers = cachear ? { "Cache-Control": "public, s-maxage=1800" } : {};
    return Response.json({ erro: mensagem }, { status: status, headers: headers });
}

export default {
    // A Vercel chama esta função toda vez que alguém acessa /api/cotacao
    async fetch(request) {
        // Lê o parâmetro "ativo" do endereço (ex.: ?ativo=PETR4)
        const url = new URL(request.url);
        const ativo = url.searchParams.get("ativo");

        // Valida: um ativo com 4 a 6 letras/números (ex.: PETR4, HGLG11)
        // OU um índice começando com ^ (ex.: ^BVSP = Ibovespa)
        if (!ativo || !/^(\^[A-Za-z]{3,5}|[A-Za-z0-9]{4,6})$/.test(ativo)) {
            return responderErro("Informe um ativo válido. Exemplo: ?ativo=PETR4", 400);
        }

        // Pega a chave no cofre da Vercel (variável de ambiente)
        const chave = process.env.BRAPI_TOKEN;

        // Se a chave não estiver configurada na Vercel, avisa no registro do servidor
        if (!chave) {
            console.error("A variável BRAPI_TOKEN não está configurada na Vercel.");
            return responderErro("Serviço de cotação não configurado.", 500);
        }

        try {
            // Pergunta à brapi pela cotação, mandando a chave no cabeçalho (não no endereço)
            const resposta = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ativo.toUpperCase())}`, {
                headers: { Authorization: `Bearer ${chave}` },
            });

            // 429: o limite do plano grátis foi atingido
            if (resposta.status === 429) {
                return responderErro("Limite de consultas atingido. Tente mais tarde.", 429);
            }

            // Qualquer outro erro da brapi (ex.: ativo que não existe)
            if (!resposta.ok) {
                return responderErro("Ativo não encontrado ou indisponível.", 404, true);
            }

            // Transforma a resposta da brapi em objeto
            const dados = await resposta.json();

            // A brapi devolve uma lista chamada "results"; pegamos o primeiro (e único) item.
            // O "?." evita erro se a lista vier vazia ou não existir
            const cotacao = dados.results?.[0];

            if (!cotacao) {
                return responderErro("Ativo não encontrado ou indisponível.", 404, true);
            }

            // Devolve só o que a página precisa, com cache de 30 minutos
            return Response.json(
                {
                    ativo: cotacao.symbol,
                    nome: cotacao.shortName,
                    preco: cotacao.regularMarketPrice,
                    variacao: cotacao.regularMarketChangePercent,
                    atualizadoEm: cotacao.regularMarketTime,
                },
                {
                    headers: {
                        // s-maxage=1800: o servidor da Vercel guarda esta resposta por 1800 s (30 min).
                        // Durante esse tempo, a brapi nem é consultada: protege o limite de 15.000/mês
                        "Cache-Control": "public, s-maxage=1800",
                    },
                }
            );
        } catch (erro) {
            // Falha de rede ou resposta inesperada: registra o detalhe só no servidor
            console.error("Falha ao consultar a brapi:", erro);
            return responderErro("Falha ao consultar a cotação.", 502);
        }
    },
};
