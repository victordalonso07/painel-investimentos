// =========================================================
// API: PREÇOS DO TESOURO DIRETO (dados abertos do Tesouro Nacional)
// Roda no servidor da Vercel, NÃO no navegador.
// Uso: /api/tesouro  → todos os títulos com o preço do último dia disponível
// Fonte: Tesouro Transparente (planilha CSV pública, atualizada 1 vez por dia)
// =========================================================

const URL_CSV =
    "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/" +
    "resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

function responderErro(mensagem, status) {
    return Response.json({ erro: mensagem }, { status: status });
}

// "Preço Unitário" → "preco unitario": sem acento e minúsculo, para achar as colunas pelo nome
function normalizar(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// O CSV do governo usa padrão brasileiro: "1.234,56" e datas "31/12/2026"
function lerNumero(texto) {
    return Number(texto.replace(/\./g, "").replace(",", "."));
}
function lerData(texto) {
    const [dia, mes, ano] = texto.split("/");
    return `${ano}-${mes}-${dia}`;   // "2026-12-31": assim dá para comparar datas como texto
}

// "Tesouro Renda+ Aposentadoria Extra" + 2065 → "TESOURO RENDA+ 2065" (o mesmo nome da lista do formulário)
function nomeDoTitulo(tipo, vencimento) {
    const ano = vencimento.slice(0, 4);
    const base = tipo.toUpperCase().replace(" APOSENTADORIA EXTRA", "").replace(/\s+/g, " ").trim();
    return `${base} ${ano}`;
}

export default {
    async fetch() {
        try {
            const resposta = await fetch(URL_CSV);
            if (!resposta.ok) {
                console.error("Tesouro Transparente respondeu:", resposta.status);
                return responderErro("Preços do Tesouro indisponíveis agora.", 502);
            }
            const texto = await resposta.text();
            const linhas = texto.split(/\r?\n/).filter((linha) => linha.trim() !== "");

            // 1ª linha = cabeçalho. Acha cada coluna PELO NOME (se mudarem a ordem, continua funcionando)
            const cabecalho = linhas[0].split(";").map(normalizar);
            const coluna = (...palavras) => cabecalho.findIndex((nome) => palavras.every((p) => nome.includes(p)));
            const iTipo = coluna("tipo");
            const iVencimento = coluna("vencimento");
            const iDataBase = coluna("data base");
            const iPrecoVenda = coluna("pu venda");    // quanto você RECEBE se vender (resgate): vale para a carteira
            const iPrecoCompra = coluna("pu compra");  // quanto custa para COMPRAR hoje

            if ([iTipo, iVencimento, iDataBase, iPrecoVenda].includes(-1)) {
                console.error("Colunas do CSV do Tesouro mudaram:", linhas[0]);
                return responderErro("Formato dos dados do Tesouro mudou.", 502);
            }

            // Passa por todas as linhas guardando, de cada título, o preço de cada dia
            const titulos = new Map();   // nome → { tipo, vencimento, precos: Map(data → {venda, compra}) }
            const datas = new Set();
            for (const linha of linhas.slice(1)) {
                const campos = linha.split(";");
                if (campos.length <= iPrecoVenda) continue;
                const vencimento = lerData(campos[iVencimento]);
                const dataBase = lerData(campos[iDataBase]);
                const nome = nomeDoTitulo(campos[iTipo], vencimento);
                if (!titulos.has(nome)) {
                    titulos.set(nome, { tipo: campos[iTipo].trim(), vencimento, precos: new Map() });
                }
                titulos.get(nome).precos.set(dataBase, {
                    venda: lerNumero(campos[iPrecoVenda]),
                    compra: iPrecoCompra >= 0 ? lerNumero(campos[iPrecoCompra]) : null,
                });
                datas.add(dataBase);
            }

            // Os dois últimos dias da planilha: hoje (ou o último útil) e o anterior, para a variação
            const [ultimaData, penultimaData] = [...datas].sort().reverse();

            const resultado = [];
            for (const [nome, titulo] of titulos) {
                const hoje = titulo.precos.get(ultimaData);
                if (!hoje) continue;   // título que não é mais negociado
                const ontem = titulo.precos.get(penultimaData);
                resultado.push({
                    nome: nome,
                    tipo: titulo.tipo,
                    vencimento: titulo.vencimento,
                    preco: hoje.venda,
                    precoCompra: hoje.compra,
                    variacao: ontem?.venda ? ((hoje.venda - ontem.venda) / ontem.venda) * 100 : null,
                });
            }
            resultado.sort((a, b) => a.nome.localeCompare(b.nome));

            return Response.json(
                { dataBase: ultimaData, titulos: resultado },
                // 6 horas de cache: a planilha só muda uma vez por dia e é um arquivo grande
                { headers: { "Cache-Control": "public, s-maxage=21600" } }
            );
        } catch (erro) {
            console.error("Falha ao ler os preços do Tesouro:", erro);
            return responderErro("Preços do Tesouro indisponíveis agora.", 502);
        }
    },
};
