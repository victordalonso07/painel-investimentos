// =========================================================
// API: COTAÇÃO DE UM ATIVO DA B3 (ação, FII, ETF, BDR)
// Roda no servidor da Vercel, NÃO no navegador.
// Uso: /api/cotacao?ativo=PETR4
// =========================================================

export default {
    assync fetch(request){
        // Lê o parâmetro "ativo" do endereço (ex.: ?ativo=PETR4)
        const url = new URL(request.url);
        const ativo = url.searchParams.get("ativo");

        // Valida: precisa existir e ter de 4 a 6 letras/números (ex.: PETR4, HGLG11)
       if (!ativo || !/^[A-Za-z0-9]{4,6}$/.test(ativo)) {
        return Response.json(
            {erro: "Infrome um ativo válido. Exemplo: ?ativo=PETR4" },
            {status: 400}
        );
       }
    }
}
