// =========================================================
// API: COTAÇÃO DE UM ATIVO DA B3 (ação, FII, ETF, BDR)
// Roda no servidor da Vercel, NÃO no navegador.
// Uso: /api/cotacao?ativo=PETR4
// =========================================================

export default {
    async fetch(request) {
        // Lê o parâmetro "ativo" do endereço (ex.: ?ativo=PETR4)
        const url = new URL(request.url);
        const ativo = url.searchParams.get("ativo");

        // Valida: precisa existir e ter de 4 a 6 letras/números (ex.: PETR4, HGLG11)
       if (!ativo || !/^[A-Za-z0-9]{4,6}$/.test(ativo)) {
        return Response.json(
            {erro: "Informe um ativo válido. Exemplo: ?ativo=PETR4" },
            {status: 400}
        );
       }

       // Pega a chave no cofre da Vercel (variável de ambiente)
       const chave = process.env.BRAPI_TOKEN;

       // Pergunta à brapi pela cotação, mandando a chave no cabeçalho (não no endereço)
       const resposta = await fetch (`https://brapi.dev/api/quote/${ativo.toUpperCase()}`, {
        headers: { Authorization: `Bearer ${chave}` },})

         // Transforma a resposta da brapi em objeto
         const dados = await resposta.json();

        // A brapi devolve uma lista chamada "results"; pegamos o primeiro (e único) item
        const cotacao = dados.results[0];

        // Devolve só o que a página precisa
        return Response.json({
            ativo: cotacao.symbol,
            nome: cotacao.shortName,
            preco: cotacao.regularMarketPrice,
            variacao: cotacao.regularMarketChangePercent,
            atualizadoEm: cotacao.regularMarketTime,
        })
    },
};
