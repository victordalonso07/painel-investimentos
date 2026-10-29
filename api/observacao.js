// =========================================================
// API: LISTA DE OBSERVAÇÃO (ativos que você acompanha)
// Roda no servidor da Vercel, NÃO no navegador.
//   GET    /api/observacao        → lista os ativos
//   POST   /api/observacao        → adiciona { ativo, tipo_ativo }
//   PATCH  /api/observacao?id=3   → muda { mostrar_inicio: true/false }
//   DELETE /api/observacao?id=3   → remove da lista
// Mesmo padrão do api/operacoes.js (chave secreta só aqui no servidor).
// =========================================================

const TIPOS_ATIVO = ["Ação", "FII", "ETF", "BDR", "Cripto", "Tesouro Direto", "Outro"];

function responderErro(mensagem, status) {
    return Response.json({ erro: mensagem }, { status: status, headers: { "Cache-Control": "no-store" } });
}

function responderJSON(dados, status = 200) {
    return Response.json(dados, { status: status, headers: { "Cache-Control": "no-store" } });
}

function cabecalhosSupabase(chave) {
    return { apikey: chave, "Content-Type": "application/json", Prefer: "return=representation" };
}

// PATCH e DELETE precisam de um id numérico no endereço (?id=3)
function lerId(request) {
    const id = new URL(request.url).searchParams.get("id");
    return id && /^\d{1,15}$/.test(id) ? id : null;
}

// Lê o corpo em JSON; devolve null se não for JSON válido
async function lerCorpo(request) {
    if (!request.headers.get("content-type")?.includes("application/json")) return null;
    try {
        return await request.json();
    } catch {
        return null;
    }
}

export default {
    async fetch(request) {
        const urlSupabase = process.env.SUPABASE_URL;
        const chave = process.env.SUPABASE_SECRET_KEY;
        if (!urlSupabase || !chave) {
            console.error("SUPABASE_URL ou SUPABASE_SECRET_KEY não está configurada na Vercel.");
            return responderErro("Banco de dados não configurado.", 500);
        }

        const tabela = `${urlSupabase}/rest/v1/observacao`;
        const headers = cabecalhosSupabase(chave);

        try {
            // ---------- LISTAR ----------
            if (request.method === "GET") {
                const resposta = await fetch(`${tabela}?select=*&order=criado_em.asc`, { headers });
                if (!resposta.ok) {
                    console.error("Supabase recusou a leitura:", resposta.status, await resposta.text());
                    return responderErro("Não foi possível ler a lista de observação.", 502);
                }
                return responderJSON(await resposta.json());
            }

            // ---------- ADICIONAR ----------
            if (request.method === "POST") {
                const corpo = await lerCorpo(request);
                if (!corpo) return responderErro("Envie os dados em JSON.", 400);

                const ativo = String(corpo.ativo ?? "").trim().toUpperCase();
                if (ativo.length < 1 || ativo.length > 40) return responderErro("Informe o ativo (até 40 caracteres).", 400);
                if (!TIPOS_ATIVO.includes(corpo.tipo_ativo)) return responderErro("Tipo de ativo inválido.", 400);

                const resposta = await fetch(tabela, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ ativo: ativo, tipo_ativo: corpo.tipo_ativo }),
                });
                // 409 = conflito: o "unique" do banco barrou um ativo repetido
                if (resposta.status === 409) return responderErro(`${ativo} já está na lista.`, 409);
                if (!resposta.ok) {
                    console.error("Supabase recusou a gravação:", resposta.status, await resposta.text());
                    return responderErro("Não foi possível adicionar.", 502);
                }
                const [criado] = await resposta.json();
                return responderJSON(criado, 201);
            }

            // ---------- MUDAR "MOSTRAR NO INÍCIO" ----------
            if (request.method === "PATCH") {
                const id = lerId(request);
                if (!id) return responderErro("Informe um id válido. Exemplo: ?id=3", 400);
                const corpo = await lerCorpo(request);
                if (!corpo || typeof corpo.mostrar_inicio !== "boolean") {
                    return responderErro("Envie { mostrar_inicio: true } ou false.", 400);
                }

                // PATCH = alterar só uma parte da linha (aqui, só a coluna mostrar_inicio)
                const resposta = await fetch(`${tabela}?id=eq.${id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ mostrar_inicio: corpo.mostrar_inicio }),
                });
                if (!resposta.ok) {
                    console.error("Supabase recusou a alteração:", resposta.status, await resposta.text());
                    return responderErro("Não foi possível alterar.", 502);
                }
                const alterados = await resposta.json();
                if (alterados.length === 0) return responderErro("Ativo não encontrado.", 404);
                return responderJSON(alterados[0]);
            }

            // ---------- REMOVER ----------
            if (request.method === "DELETE") {
                const id = lerId(request);
                if (!id) return responderErro("Informe um id válido. Exemplo: ?id=3", 400);
                const resposta = await fetch(`${tabela}?id=eq.${id}`, { method: "DELETE", headers });
                if (!resposta.ok) {
                    console.error("Supabase recusou a exclusão:", resposta.status, await resposta.text());
                    return responderErro("Não foi possível remover.", 502);
                }
                const apagados = await resposta.json();
                if (apagados.length === 0) return responderErro("Ativo não encontrado.", 404);
                return responderJSON(apagados[0]);
            }

            return new Response(null, { status: 405, headers: { Allow: "GET, POST, PATCH, DELETE" } });
        } catch (erro) {
            console.error("Falha ao falar com o Supabase:", erro);
            return responderErro("Falha ao acessar o banco de dados.", 502);
        }
    },
};
