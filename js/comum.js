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


// Os 3 pontinhos animados de "carregando" (a animação está no CSS, classe .pontinhos)
const PONTINHOS = `<span class="pontinhos" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>`;

// Escreve um texto de carregando com os pontinhos animados: mostrarCarregando(el, "Carregando histórico")
// O texto entra com textContent (seguro); só os pontinhos, que são fixos, entram como HTML
function mostrarCarregando(elemento, texto) {
    elemento.textContent = texto;
    elemento.insertAdjacentHTML("beforeend", PONTINHOS);
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
    USDT: "tether", USDC: "usd-coin", AVAX: "avalanche-2",
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

    // Tesouro Direto: uma consulta traz todos os títulos (/api/tesouro)
    const titulos = posicoes.filter((p) => p.tipo === "Tesouro Direto");
    if (titulos.length > 0) {
        let precos = new Map();
        try {
            precos = await buscarPrecosTesouro();
        } catch (erro) {
            console.error("Falha ao buscar preços do Tesouro:", erro);
        }
        for (const p of titulos) aoChegar(p, precos.get(nomeTesouro(p.ativo)) ?? null);
    }

    // Outro (CDB, LCI...): sem fonte de preço grátis
    for (const p of posicoes.filter((p) => p.tipo === "Outro")) {
        aoChegar(p, null);
    }
}

// "tesouro  selic 2031" → "TESOURO SELIC 2031": maiúsculo e com espaços simples, para comparar nomes
function nomeTesouro(texto) {
    return texto.toUpperCase().replace(/\s+/g, " ").trim();
}

// Busca os preços do Tesouro UMA vez por página e reaproveita (a planilha é grande).
// Guardamos a "promessa": se duas partes da página pedirem juntas, as duas esperam a mesma busca
let promessaTesouro = null;
function buscarPrecosTesouro() {
    promessaTesouro ??= buscarJSON("/api/tesouro").then((dados) => {
        const precos = new Map();
        for (const titulo of dados.titulos) {
            precos.set(nomeTesouro(titulo.nome), {
                preco: titulo.preco,               // preço de VENDA (resgate): vale para calcular o valor atual
                precoCompra: titulo.precoCompra,   // preço de COMPRA: o que você paga para comprar hoje
                variacao: titulo.variacao,
            });
        }
        return precos;
    });
    // Se der erro, esquece a promessa para tentar de novo na próxima vez
    promessaTesouro.catch(() => { promessaTesouro = null; });
    return promessaTesouro;
}


// ---------------------------------------------------------
// Lista de ativos do formulário (Carteira e Observação)
// Os 10 principais de cada tipo + "Outro" para digitar qualquer um
// ---------------------------------------------------------
const ATIVOS_SUGERIDOS = {
    "Ação": ["PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "WEGE3", "B3SA3", "ITSA4", "PRIO3"],
    "FII": ["MXRF11", "HGLG11", "KNRI11", "XPML11", "VISC11", "KNCR11", "BTLG11", "XPLG11", "HGRU11", "CPTS11"],
    "ETF": ["BOVA11", "IVVB11", "SMAL11", "BOVV11", "DIVO11", "HASH11", "NASD11", "GOLD11", "SPXI11", "XINA11"],
    "BDR": ["AAPL34", "MSFT34", "AMZO34", "GOGL34", "NVDC34", "TSLA34", "M1TA34", "NFLX34", "DISB34", "JPMC34"],
    "Cripto": ["BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX", "USDT", "USDC"],
    "Tesouro Direto": [
        "TESOURO SELIC 2029", "TESOURO SELIC 2031", "TESOURO PREFIXADO 2029", "TESOURO PREFIXADO 2031",
        "TESOURO IPCA+ 2029", "TESOURO IPCA+ 2035", "TESOURO IPCA+ 2045",
        "TESOURO IPCA+ COM JUROS SEMESTRAIS 2035", "TESOURO RENDA+ 2065", "TESOURO EDUCA+ 2035",
    ],
    "Outro": [],   // sem lista: só o campo de texto
};

const OPCAO_OUTRO = "__outro__";   // valor especial da opção "Outro (digitar)"

// Liga o seletor de Tipo ao de Ativo: trocar o tipo troca a lista de ativos.
// Escolher "Outro (digitar)" mostra o campo de texto.
function configurarSeletorAtivo(formulario) {
    const tipo = formulario.querySelector("#tipo");
    const lista = formulario.querySelector("#ativo-lista");
    const campoOutro = formulario.querySelector("#campo-ativo-outro");
    const texto = formulario.querySelector("#ativo");

    // Mostra ou esconde o campo de texto, conforme a opção escolhida
    function atualizarCampoOutro() {
        const digitar = lista.value === OPCAO_OUTRO;
        campoOutro.hidden = !digitar;
        texto.required = digitar;   // só é obrigatório quando aparece
    }

    // Recria as opções da lista para o tipo escolhido
    function preencherLista() {
        lista.innerHTML = "";
        for (const ativo of ATIVOS_SUGERIDOS[tipo.value] ?? []) {
            // new Option(texto, valor): cria um <option> sem usar innerHTML
            lista.appendChild(new Option(ativo, ativo));
        }
        lista.appendChild(new Option("Outro (digitar)", OPCAO_OUTRO));
        atualizarCampoOutro();
    }

    tipo.addEventListener("change", preencherLista);
    lista.addEventListener("change", () => {
        atualizarCampoOutro();
        if (lista.value === OPCAO_OUTRO) texto.focus();
    });
    // Depois do formulário.reset(), a lista volta a ser a do tipo inicial (Ação)
    formulario.addEventListener("reset", () => setTimeout(preencherLista));

    preencherLista();
}

// Preenche Tipo e Ativo do formulário com um ativo já existente (usado ao EDITAR uma operação).
// Se o ativo não estiver na lista dos 10 principais, escolhe "Outro (digitar)" e escreve no campo de texto
function escolherAtivo(formulario, tipoAtivo, ativo) {
    const tipo = formulario.querySelector("#tipo");
    const lista = formulario.querySelector("#ativo-lista");
    tipo.value = tipoAtivo;
    tipo.dispatchEvent(new Event("change"));   // finge a troca de tipo: a lista de ativos é recriada
    const temNaLista = [...lista.options].some((opcao) => opcao.value === ativo);
    lista.value = temNaLista ? ativo : OPCAO_OUTRO;
    formulario.querySelector("#ativo").value = temNaLista ? "" : ativo;
    lista.dispatchEvent(new Event("change"));  // mostra ou esconde o campo de texto
}

// Lê o ativo escolhido: da lista, ou do campo de texto se for "Outro"
function lerAtivo(formulario) {
    const lista = formulario.querySelector("#ativo-lista");
    const valor = lista.value === OPCAO_OUTRO ? formulario.querySelector("#ativo").value : lista.value;
    return valor.trim().toUpperCase();
}

// Põe o cursor no campo de ativo que estiver visível
function focarAtivo(formulario) {
    const lista = formulario.querySelector("#ativo-lista");
    (lista.value === OPCAO_OUTRO ? formulario.querySelector("#ativo") : lista).focus();
}


// ---------------------------------------------------------
// Preço de um ativo numa data (usado no cadastro: você informa o VALOR, o site calcula a quantidade)
// Devolve o preço por unidade, ou null se não encontrar (aí o formulário pede o preço à mão)
// ---------------------------------------------------------

// Data de hoje no formato "2026-11-03", no fuso do Brasil (e não no de Londres, como o toISOString)
function dataDeHoje() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

async function buscarPrecoNaData(ativo, tipo, data, tipoOperacao) {
    const hoje = data === dataDeHoje();

    // Ação, FII, ETF, BDR
    if (TIPOS_B3.includes(tipo)) {
        if (hoje) return (await buscarCotacaoB3(ativo)).preco;
        // Dia anterior: procura no histórico (máximo de 3 meses no plano grátis da brapi)
        const historico = await buscarJSON(`/api/historico?ativo=${encodeURIComponent(ativo)}&periodo=3mo`);
        // Pega o último pregão até a data escolhida (fim de semana e feriado não têm preço)
        const dias = historico.pontos.filter((ponto) => new Date(ponto.data).toISOString().slice(0, 10) <= data);
        if (dias.length === 0) return null;   // data mais antiga que 3 meses
        return dias[dias.length - 1].preco;
    }

    // Cripto (CoinGecko)
    if (tipo === "Cripto") {
        const id = IDS_COINGECKO[ativo];
        if (!id) return null;
        if (hoje) return (await buscarCotacoesCripto([ativo]))[ativo]?.preco ?? null;
        const [ano, mes, dia] = data.split("-");   // a CoinGecko pede a data como "03-11-2026"
        const dados = await buscarJSON(
            `https://api.coingecko.com/api/v3/coins/${id}/history?date=${dia}-${mes}-${ano}&localization=false`
        );
        return dados.market_data?.current_price?.brl ?? null;
    }

    // Tesouro Direto: só temos o preço do último dia disponível
    if (tipo === "Tesouro Direto") {
        if (!hoje) return null;
        const titulo = (await buscarPrecosTesouro()).get(nomeTesouro(ativo));
        if (!titulo) return null;
        // Quem compra paga o preço de compra; quem vende (resgata) recebe o de venda
        return tipoOperacao === "compra" ? (titulo.precoCompra ?? titulo.preco) : titulo.preco;
    }

    return null;   // "Outro" (CDB, LCI...): não há preço de mercado
}