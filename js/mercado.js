// =========================================================
// MERCADO: cotações reais na página Início
// - Ibovespa e S&P 500: pela NOSSA API (/api/cotacao), usando os ETFs
//   BOVA11 (copia o Ibovespa) e IVVB11 (copia o S&P 500)
// - Dólar: AwesomeAPI (grátis, sem chave)
// - Bitcoin: CoinGecko (grátis, sem chave)
// =========================================================

// (formatarReais, formatarPercentual, buscarJSON e buscarCotacaoB3 estão no js/comum.js)

// Mostra a variação num elemento e pinta de verde (alta) ou vermelho (baixa).
// As classes "positivo" e "negativo" já existem no CSS (com as setas ▲ ▼)
function mostrarVariacao(elemento, variacao) {
    elemento.textContent = formatarPercentual(variacao);
    pintarSinal(elemento, variacao);
}

// ---------------------------------------------------------
// Ibovespa e S&P 500: variação do dia pela nossa API
// ---------------------------------------------------------
async function buscarIndice(ativo, idElemento) {
    const elemento = document.getElementById(idElemento);
    try {
        const dados = await buscarCotacaoB3(ativo);   // entra na fila da brapi
        mostrarVariacao(elemento, dados.variacao);
    } catch (erro) {
        elemento.textContent = "Indisponível";
        console.error(`Falha ao buscar ${ativo}:`, erro);
    }
}

// ---------------------------------------------------------
// Dólar comercial: AwesomeAPI
// ---------------------------------------------------------
async function buscarDolar() {
    const elementoValor = document.getElementById("dolar-valor");
    const elementoVariacao = document.getElementById("dolar-variacao");
    try {
        const dados = await buscarJSON("https://economia.awesomeapi.com.br/json/last/USD-BRL");
        // "bid" = valor de compra; "pctChange" = variação do dia em %. Os dois vêm como texto
        elementoValor.textContent = formatarReais(Number(dados.USDBRL.bid));
        mostrarVariacao(elementoVariacao, Number(dados.USDBRL.pctChange));
    } catch (erro) {
        elementoValor.textContent = "Indisponível";
        console.error("Falha ao buscar o dólar:", erro);
    }
}

// ---------------------------------------------------------
// Bitcoin: CoinGecko (preço em reais e variação de 24 horas)
// ---------------------------------------------------------
async function buscarBitcoin() {
    const elementoValor = document.getElementById("bitcoin-valor");
    const elementoVariacao = document.getElementById("bitcoin-variacao");
    try {
        const dados = await buscarJSON(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true"
        );
        elementoValor.textContent = formatarReais(dados.bitcoin.brl);
        mostrarVariacao(elementoVariacao, dados.bitcoin.brl_24h_change);
    } catch (erro) {
        elementoValor.textContent = "Indisponível";
        console.error("Falha ao buscar o Bitcoin:", erro);
    }
}

// ---------------------------------------------------------
// Mostra a hora da última atualização no topo da página
// ---------------------------------------------------------
function mostrarHorario() {
    const elemento = document.getElementById("horario-atualizacao");
    const agora = new Date();
    elemento.textContent = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    elemento.dateTime = agora.toISOString();
}

// ---------------------------------------------------------
// Começa tudo assim que o arquivo carregar
// ---------------------------------------------------------
async function carregarMercado() {
    // Dólar e Bitcoin vêm de APIs diferentes: podem ser buscados ao mesmo tempo
    buscarDolar();
    buscarBitcoin();

    // Os dois ETFs entram na fila da brapi (1 consulta por vez, ver js/comum.js)
    await Promise.all([
        buscarIndice("BOVA11", "ibovespa-variacao"),
        buscarIndice("IVVB11", "sp500-variacao"),
    ]);

    mostrarHorario();
}

carregarMercado();
