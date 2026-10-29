// =========================================================
// COMUM: funções usadas por mais de uma página
// (formatação, busca de cotações, cálculo de posições)
// Carregue este arquivo ANTES dos outros scripts da página.
// =========================================================


// ---------------------------------------------------------
// Formatação
// ---------------------------------------------------------

// Dinheiro brasileiro: 385 → "R$ 385,00"
function formatarReais(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Quantidade sem arredondar demais: 0.0004 → "0,0004"
function formatarQuantidade(valor) {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

// Variação em %: 1.234 → "+1,23%" e -0.5 → "-0,50%"
function formatarPercentual(valor) {
    const sinal = valor > 0 ? "+" : "";
    const numero = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sinal}${numero}%`;
}

// Valor com sinal e %: (60, 700) → "+ R$ 60,00 (+8,57%)"
function formatarResultado(valor, base) {
    const sinal = valor > 0 ? "+ " : valor < 0 ? "- " : "";
    const percentual = base > 0 ? (valor / base) * 100 : 0;
    return `${sinal}${formatarReais(Math.abs(valor))} (${formatarPercentual(percentual)})`;
}

// Data do banco para a tela: "2026-10-01" → "01/10/2026"
function formatarData(texto) {
    const [ano, mes, dia] = texto.split("-");
    return `${dia}/${mes}/${ano}`;
}

// Pinta um elemento de verde (positivo) ou vermelho (negativo); as setas ▲ ▼ vêm do CSS
function pintarSinal(elemento, valor) {
    elemento.classList.remove("positivo", "negativo");
    if (valor > 0) elemento.classList.add("positivo");
    if (valor < 0) elemento.classList.add("negativo");
}


// Mostra a hora da última atualização no topo da página ("Atualizado às 14:05")
function mostrarHorario() {
    const elemento = document.getElementById("horario-atualizacao");
    if (!elemento) return;
    const agora = new Date();
    elemento.textContent = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    elemento.dateTime = agora.toISOString();
}


// ---------------------------------------------------------
// Busca de dados
// ---------------------------------------------------------

// Busca um endereço e devolve o JSON; se a resposta vier com erro, lança um erro
async function buscarJSON(endereco) {
    const resposta = await fetch(endereco);
    if (!resposta.ok) {
        throw new Error(`${endereco} respondeu com o código ${resposta.status}`);
    }
    return resposta.json();
}

// Tipos com cotação na brapi (pela nossa /api/cotacao)
const TIPOS_B3 = ["Ação", "FII", "ETF", "BDR"];

// A CoinGecko identifica as moedas por nome ("bitcoin"), não por sigla ("BTC")
const IDS_COINGECKO = {
    BTC: "bitcoin", BITCOIN: "bitcoin",
    ETH: "ethereum", ETHEREUM: "ethereum",
    SOL: "solana", SOLANA: "solana",
    BNB: "binancecoin", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin",
    USDT: "tether", USDC: "usd-coin",
};

// FILA da brapi: o plano grátis aceita 1 consulta por vez.
// Cada pedido novo "entra na fila" e só começa quando o anterior terminar,
// mesmo que venham de arquivos diferentes (mercado.js e inicio.js, por exemplo).
let filaB3 = Promise.resolve();

// Cotação de um ativo da B3 → { preco, variacao } (variação do dia, em %)
function buscarCotacaoB3(ativo) {
    const pedido = filaB3.then(() => buscarJSON(`/api/cotacao?ativo=${encodeURIComponent(ativo)}`));
    // A fila segue mesmo se este pedido der erro (o catch "engole" o erro só para a fila)
    filaB3 = pedido.catch(() => {});
    return pedido;
}

// Cotações de várias criptos numa consulta só → { BTC: { preco, variacao }, ... }
async function buscarCotacoesCripto(siglas) {
    const ids = [...new Set(siglas.map((s) => IDS_COINGECKO[s]).filter(Boolean))];
    if (ids.length === 0) return {};
    const dados = await buscarJSON(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=brl&include_24hr_change=true`
    );
    const cotacoes = {};
    for (const sigla of siglas) {
        const moeda = dados[IDS_COINGECKO[sigla]];
        if (moeda) cotacoes[sigla] = { preco: moeda.brl, variacao: moeda.brl_24h_change };
    }
    return cotacoes;
}

// Operações salvas no banco (pela nossa /api/operacoes)
function buscarOperacoes() {
    return buscarJSON("/api/operacoes");
}

// Lista de observação (pela nossa /api/observacao)
function buscarObservacao() {
    return buscarJSON("/api/observacao");
}


// ---------------------------------------------------------
// Posições: junta as operações de cada ativo
// - Preço médio = quanto você pagou, em média, por unidade
// ---------------------------------------------------------
function calcularPosicoes(operacoes) {
    // A API devolve as mais recentes primeiro; o cálculo precisa da ordem em que aconteceram
    const emOrdem = [...operacoes].sort((a, b) =>
        a.data_operacao.localeCompare(b.data_operacao) || a.id - b.id
    );

    // Map: um "dicionário" ativo → posição (ex.: "PETR4" → { quantidade, custo, ... })
    const posicoes = new Map();

    for (const op of emOrdem) {
        if (!posicoes.has(op.ativo)) {
            posicoes.set(op.ativo, { ativo: op.ativo, tipo: op.tipo_ativo, quantidade: 0, custo: 0 });
        }
        const posicao = posicoes.get(op.ativo);
        const quantidade = Number(op.quantidade);

        if (op.tipo_operacao === "compra") {
            // Compra: soma a quantidade e o quanto custou (incluindo taxas)
            posicao.quantidade += quantidade;
            posicao.custo += quantidade * Number(op.preco_unitario) + Number(op.taxas ?? 0);
        } else {
            // Venda: tira a quantidade, e o custo sai pelo preço médio (o preço médio não muda)
            const precoMedio = posicao.quantidade > 0 ? posicao.custo / posicao.quantidade : 0;
            posicao.quantidade -= quantidade;
            posicao.custo -= quantidade * precoMedio;
        }
    }

    // Só ficam as posições que ainda têm quantidade (vendeu tudo = sai da lista)
    return [...posicoes.values()]
        .filter((p) => p.quantidade > 1e-9)
        .map((p) => ({ ...p, precoMedio: p.custo / p.quantidade }))
        .sort((a, b) => b.custo - a.custo);   // maiores primeiro
}

// Busca a cotação de cada posição. Chama aoChegar(posicao, cotacao) a cada preço que chega
// (cotacao = { preco, variacao }, ou null se não houver cotação para esse ativo)
async function cotarPosicoes(posicoes, aoChegar) {
    // Cripto: tudo de uma vez
    const criptos = posicoes.filter((p) => p.tipo === "Cripto");
    let cotacoesCripto = {};
    try {
        cotacoesCripto = await buscarCotacoesCripto(criptos.map((p) => p.ativo));
    } catch (erro) {
        console.error("Falha ao buscar preços de cripto:", erro);
    }
    for (const p of criptos) aoChegar(p, cotacoesCripto[p.ativo] ?? null);

    // B3: um por vez (pela fila)
    for (const p of posicoes.filter((p) => TIPOS_B3.includes(p.tipo))) {
        try {
            const dados = await buscarCotacaoB3(p.ativo);
            aoChegar(p, { preco: dados.preco, variacao: dados.variacao });
        } catch (erro) {
            console.error(`Falha ao buscar ${p.ativo}:`, erro);
            aoChegar(p, null);
        }
    }

    // Tesouro Direto e Outro: ainda sem fonte de preço
    for (const p of posicoes.filter((p) => p.tipo !== "Cripto" && !TIPOS_B3.includes(p.tipo))) {
        aoChegar(p, null);
    }
}
