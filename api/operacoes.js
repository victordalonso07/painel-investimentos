// =========================================================
// API: OPERAÇÕES DA CARTEIRA (compras e vendas)
// Roda no servidor da Vercel, NÃO no navegador.
//   GET  /api/operacoes  → lista todas as operações
//   POST /api/operacoes  → grava uma operação nova (dados em JSON)
// Conversa com o banco Supabase usando a chave secreta, guardada no cofre da Vercel.
// =========================================================

const TIPOS_OPERACAO = ["compra", "venda"];
const TIPOS_ATIVO = ["Ação", "FII", "ETF", "BDR", "Cripto", "Tesouro Direto", "Outro"];

// Responde com um erro em JSON, sempre no mesmo formato: { erro: "..." }
function responderErro(mensagem, status) {
    return Response.json({ erro: mensagem }, { status: status, headers: { "Cache-Control": "no-store" } });
}

// Monta os cabeçalhos que o Supabase exige: a chave vai no "apikey" (nunca no endereço)
function cabecalhosSupabase(chave) {
    return { apikey: chave, "Content-Type": "application/json" };
}

// Confere os dados recebidos ANTES de mandar para o banco.
// Devolve { erro } se algo estiver errado, ou { operacao } com os dados limpos.
// (O banco também confere, com os "check" do db/schema.sql: são duas camadas de proteção.)
function validarOperacao(corpo) {
    if (!corpo || typeof corpo !== "object") {
        return { erro: "Envie os dados da operação em JSON." };
    }

    const tipoOperacao = corpo.tipo_operacao ?? "compra";
    const ativo = String(corpo.ativo ?? "").trim().toUpperCase();
    const tipoAtivo = corpo.tipo_ativo;
    const quantidade = Number(corpo.quantidade);
    const precoUnitario = Number(corpo.preco_unitario);
    const taxas = Number(corpo.taxas ?? 0);
    const corretora = corpo.corretora ? String(corpo.corretora).trim() : null;
    const dataOperacao = String(corpo.data_operacao ?? "");

    if (!TIPOS_OPERACAO.includes(tipoOperacao)) return { erro: "Tipo de operação inválido." };
    if (ativo.length < 1 || ativo.length > 40) return { erro: "Informe o ativo (até 40 caracteres)." };
    if (!TIPOS_ATIVO.includes(tipoAtivo)) return { erro: "Tipo de ativo inválido." };
    if (!Number.isFinite(quantidade) || quantidade <= 0) return { erro: "A quantidade precisa ser maior que zero." };
    if (!Number.isFinite(precoUnitario) || precoUnitario < 0) return { erro: "O preço não pode ser negativo." };
    if (!Number.isFinite(taxas) || taxas < 0) return { erro: "As taxas não podem ser negativas." };
    if (corretora && corretora.length > 40) return { erro: "Nome da corretora muito longo." };

    // Data no formato AAAA-MM-DD (é o que o <input type="date"> envia) e não pode ser no futuro
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataOperacao) || Number.isNaN(Date.parse(dataOperacao))) {
        return { erro: "Data inválida." };
    }
    const hoje = new Date().toISOString().slice(0, 10);
    if (dataOperacao > hoje) return { erro: "A data não pode ser no futuro." };

    return {
        operacao: {
            tipo_operacao: tipoOperacao,
            ativo: ativo,
            tipo_ativo: tipoAtivo,
            quantidade: quantidade,
            preco_unitario: precoUnitario,
            taxas: taxas,
            corretora: corretora,
            data_operacao: dataOperacao,
        },
    };
}

export default {
    async fetch(request) {
        // Pega o endereço do projeto e a chave secreta no cofre da Vercel
        const urlSupabase = process.env.SUPABASE_URL;
        const chave = process.env.SUPABASE_SECRET_KEY;

        if (!urlSupabase || !chave) {
            console.error("SUPABASE_URL ou SUPABASE_SECRET_KEY não está configurada na Vercel.");
            return responderErro("Banco de dados não configurado.", 500);
        }

        // Endereço da tabela "operacoes" na API do Supabase
        const tabela = `${urlSupabase}/rest/v1/operacoes`;

        try {
            // ---------- LISTAR (GET) ----------
            if (request.method === "GET") {
                // Mais recentes primeiro
                const resposta = await fetch(`${tabela}?select=*&order=data_operacao.desc,id.desc`, {
                    headers: cabecalhosSupabase(chave),
                });
                if (!resposta.ok) {
                    console.error("Supabase recusou a leitura:", resposta.status, await resposta.text());
                    return responderErro("Não foi possível ler a carteira.", 502);
                }
                const operacoes = await resposta.json();
                // no-store: dado pessoal, nenhum cache pode guardar
                return Response.json(operacoes, { headers: { "Cache-Control": "no-store" } });
            }

            // ---------- GRAVAR (POST) ----------
            if (request.method === "POST") {
                // Exige JSON: isso também impede que outro site envie um formulário "escondido" para cá
                if (!request.headers.get("content-type")?.includes("application/json")) {
                    return responderErro("Envie os dados em JSON.", 415);
                }

                let corpo;
                try {
                    corpo = await request.json();
                } catch {
                    return responderErro("JSON inválido.", 400);
                }

                const { erro, operacao } = validarOperacao(corpo);
                if (erro) return responderErro(erro, 400);

                const resposta = await fetch(tabela, {
                    method: "POST",
                    // return=representation: o banco devolve a linha criada (com id e criado_em)
                    headers: { ...cabecalhosSupabase(chave), Prefer: "return=representation" },
                    body: JSON.stringify(operacao),
                });
                if (!resposta.ok) {
                    console.error("Supabase recusou a gravação:", resposta.status, await resposta.text());
                    return responderErro("Não foi possível salvar a operação.", 502);
                }
                const [criada] = await resposta.json();
                return Response.json(criada, { status: 201, headers: { "Cache-Control": "no-store" } });
            }

            // Qualquer outro método (PUT, DELETE...) ainda não existe
            return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
        } catch (erro) {
            console.error("Falha ao falar com o Supabase:", erro);
            return responderErro("Falha ao acessar o banco de dados.", 502);
        }
    },
};
