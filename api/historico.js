// =========================================================
// API: HISTÓRICO DE PREÇOS DE UM ATIVO DA B3 (para o gráfico)
// Roda no servidor da Vercel, NÃO no navegador.
// Uso: /api/historico?ativo=PETR4&periodo=1mo
// Períodos: 5d (5 dias), 1mo (1 mês), 3mo (3 meses — o máximo do plano grátis da brapi)
// =========================================================

const PERIODOS = ["5d", "1mo", "3mo"];

function responderErro(mensagem, status, cachear = false) {
    const headers = cachear ? { "Cache-Control": "public, s-maxage=3600" } : {};
    return Response.json({ erro: mensagem }, { status: status, headers: headers });
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const ativo = url.searchParams.get("ativo");
        const periodo = url.searchParams.get("periodo");

        if (!ativo || !/^[A-Za-z0-9]{4,6}$/.test(ativo)) {
            return responderErro("Informe um ativo válido. Exemplo: ?ativo=PETR4&periodo=1mo", 400);
        }
        if (!PERIODOS.includes(periodo)) {
            return responderErro("Período inválido. Use 5d, 1mo ou 3mo.", 400);
        }

        const chave = process.env.BRAPI_TOKEN;
        if (!chave) {
            console.error("A variável BRAPI_TOKEN não está configurada na Vercel.");
            return responderErro("Serviço de cotação não configurado.", 500);
        }

        try {
            // range = período; interval=1d = um ponto por dia (o preço de fechamento)
            const resposta = await fetch(
                `https://brapi.dev/api/quote/${encodeURIComponent(ativo.toUpperCase())}?range=${periodo}&interval=1d`,
                { headers: { Authorization: `Bearer ${chave}` } }
            );
            if (resposta.status === 429) return responderErro("Limite de consultas atingido. Tente mais tarde.", 429);
            if (!resposta.ok) return responderErro("Histórico não encontrado para este ativo.", 404, true);

            const dados = await resposta.json();
            const historico = dados.results?.[0]?.historicalDataPrice ?? [];

            // Fica só com o que o gráfico precisa: data (em milissegundos) e preço de fechamento
            const pontos = historico
                .filter((dia) => typeof dia.close === "number")
                .map((dia) => ({ data: dia.date * 1000, preco: dia.close }))   // a brapi manda em segundos
                .sort((a, b) => a.data - b.data);

            if (pontos.length === 0) return responderErro("Histórico não encontrado para este ativo.", 404, true);

            return Response.json(
                { ativo: ativo.toUpperCase(), periodo: periodo, pontos: pontos },
                // 1 hora de cache: o histórico do dia quase não muda e economiza consultas da brapi
                { headers: { "Cache-Control": "public, s-maxage=3600" } }
            );
        } catch (erro) {
            console.error("Falha ao consultar o histórico na brapi:", erro);
            return responderErro("Falha ao consultar o histórico.", 502);
        }
    },
};
