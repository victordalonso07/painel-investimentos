// =========================================================
// RENDIMENTO: junta as operações em POSIÇÕES e calcula o resultado
// - Posição = tudo que você tem de um mesmo ativo (várias compras somadas)
// - Preço médio = quanto você pagou, em média, por unidade
// - Preço atual: /api/cotacao (B3) ou CoinGecko (cripto)
// Usado pelo js/carteira.js (este arquivo carrega antes dele).
// =========================================================

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

// Controle de "qual carregamento é o mais recente".
// Se a lista for recarregada no meio da busca de preços, a busca antiga para de mexer na tela
let cargaAtual = 0;


// ---------------------------------------------------------
// 1. Agrupar: transforma a lista de operações em posições
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


// ---------------------------------------------------------
// 2. Desenhar: um <li> por posição, com os preços "Carregando…"
// ---------------------------------------------------------
function criarItemPosicao(posicao) {
    const item = document.createElement("li");
    item.innerHTML = `
        <article class="posicao posicao-resumo">
            <div class="posicao-nome">
                <h3></h3>
                <p class="tipo"></p>
            </div>
            <dl>
                <div><dt>Quantidade</dt><dd class="campo-quantidade"></dd></div>
                <div><dt>Preço médio</dt><dd class="campo-preco-medio"></dd></div>
                <div><dt>Total investido</dt><dd class="campo-investido"></dd></div>
                <div><dt>Preço atual</dt><dd class="campo-preco-atual">Carregando…</dd></div>
                <div><dt>Valor atual</dt><dd class="campo-valor-atual">Carregando…</dd></div>
                <div><dt>Resultado</dt><dd class="campo-resultado">Carregando…</dd></div>
            </dl>
        </article>
    `;
    item.querySelector("h3").textContent = posicao.ativo;
    item.querySelector(".tipo").textContent = posicao.tipo;
    item.querySelector(".campo-quantidade").textContent = formatarQuantidade(posicao.quantidade);
    item.querySelector(".campo-preco-medio").textContent = formatarReais(posicao.precoMedio);
    item.querySelector(".campo-investido").textContent = formatarReais(posicao.custo);
    return item;
}

// Escreve o resultado: "+ R$ 20,00 (+2,00%)" em verde, ou "- R$ 5,00 (-1,00%)" em vermelho
function mostrarResultado(elemento, resultado, investido) {
    const percentual = investido > 0 ? (resultado / investido) * 100 : 0;
    const sinal = resultado > 0 ? "+ " : resultado < 0 ? "- " : "";
    const pct = percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    elemento.textContent = `${sinal}${formatarReais(Math.abs(resultado))} (${percentual > 0 ? "+" : ""}${pct}%)`;
    elemento.classList.remove("positivo", "negativo");
    if (resultado > 0) elemento.classList.add("positivo");
    if (resultado < 0) elemento.classList.add("negativo");
}


// ---------------------------------------------------------
// 3. Buscar preços
// ---------------------------------------------------------

// Cripto: uma única consulta à CoinGecko com todas as moedas juntas
async function buscarPrecosCripto(siglas) {
    const ids = [...new Set(siglas.map((s) => IDS_COINGECKO[s]).filter(Boolean))];
    if (ids.length === 0) return {};
    const resposta = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=brl`
    );
    if (!resposta.ok) throw new Error(`CoinGecko respondeu ${resposta.status}`);
    const dados = await resposta.json();
    // Volta para a sigla: { BTC: 350000, ETH: 18000 }
    const precos = {};
    for (const sigla of siglas) {
        const id = IDS_COINGECKO[sigla];
        if (id && dados[id]) precos[sigla] = dados[id].brl;
    }
    return precos;
}

// B3: uma consulta por ativo pela NOSSA API (a chave da brapi fica no servidor)
async function buscarPrecoB3(ativo) {
    const resposta = await fetch(`/api/cotacao?ativo=${encodeURIComponent(ativo)}`);
    if (!resposta.ok) throw new Error(`/api/cotacao respondeu ${resposta.status}`);
    const dados = await resposta.json();
    return dados.preco;
}


// ---------------------------------------------------------
// 4. Juntar tudo: desenha as posições e vai preenchendo os preços
// ---------------------------------------------------------
async function atualizarPosicoes(operacoes, listaPosicoes, resumoCarteira) {
    const minhaCarga = ++cargaAtual;
    const posicoes = calcularPosicoes(operacoes);

    listaPosicoes.innerHTML = "";
    if (posicoes.length === 0) {
        resumoCarteira.textContent = "Nenhuma posição aberta. Use o formulário para cadastrar a primeira compra.";
        return;
    }

    const itens = new Map();   // ativo → <li>, para preencher o preço depois
    for (const posicao of posicoes) {
        const item = criarItemPosicao(posicao);
        itens.set(posicao.ativo, item);
        listaPosicoes.appendChild(item);
    }

    const totalInvestido = posicoes.reduce((soma, p) => soma + p.custo, 0);
    resumoCarteira.textContent = `Total investido: ${formatarReais(totalInvestido)}. Buscando cotações…`;

    // Preenche UMA posição quando o preço chega (ou "Sem cotação" se não houver)
    let valorAtualTotal = 0;
    let semCotacao = 0;
    function preencher(posicao, preco) {
        const item = itens.get(posicao.ativo);
        if (typeof preco !== "number") {
            item.querySelector(".campo-preco-atual").textContent = "Sem cotação";
            item.querySelector(".campo-valor-atual").textContent = "—";
            item.querySelector(".campo-resultado").textContent = "—";
            valorAtualTotal += posicao.custo;   // sem preço: conta pelo valor investido
            semCotacao++;
            return;
        }
        const valorAtual = posicao.quantidade * preco;
        item.querySelector(".campo-preco-atual").textContent = formatarReais(preco);
        item.querySelector(".campo-valor-atual").textContent = formatarReais(valorAtual);
        mostrarResultado(item.querySelector(".campo-resultado"), valorAtual - posicao.custo, posicao.custo);
        valorAtualTotal += valorAtual;
    }

    // Cripto: tudo de uma vez
    const criptos = posicoes.filter((p) => p.tipo === "Cripto");
    let precosCripto = {};
    try {
        precosCripto = await buscarPrecosCripto(criptos.map((p) => p.ativo));
    } catch (erro) {
        console.error("Falha ao buscar preços de cripto:", erro);
    }
    if (minhaCarga !== cargaAtual) return;   // a lista foi recarregada: esta busca ficou velha
    for (const p of criptos) preencher(p, precosCripto[p.ativo]);

    // B3: um ativo por vez (a brapi grátis aceita 1 consulta de cada vez)
    for (const p of posicoes.filter((p) => TIPOS_B3.includes(p.tipo))) {
        let preco;
        try {
            preco = await buscarPrecoB3(p.ativo);
        } catch (erro) {
            console.error(`Falha ao buscar ${p.ativo}:`, erro);
        }
        if (minhaCarga !== cargaAtual) return;
        preencher(p, preco);
    }

    // Tesouro Direto e Outro: ainda sem fonte de preço
    for (const p of posicoes.filter((p) => p.tipo !== "Cripto" && !TIPOS_B3.includes(p.tipo))) {
        preencher(p, undefined);
    }

    // Resumo final
    const resultado = valorAtualTotal - totalInvestido;
    const pct = totalInvestido > 0 ? (resultado / totalInvestido) * 100 : 0;
    const sinal = resultado >= 0 ? "+" : "-";
    resumoCarteira.textContent =
        `Total investido: ${formatarReais(totalInvestido)}. ` +
        `Valor atual: ${formatarReais(valorAtualTotal)}. ` +
        `Resultado: ${sinal} ${formatarReais(Math.abs(resultado))} ` +
        `(${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%).` +
        (semCotacao > 0 ? ` ${semCotacao} ativo(s) sem cotação entram pelo valor investido.` : "");
}
