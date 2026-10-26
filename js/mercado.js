// =========================================================
// MERCADO: cotações reais na página Início
// - Ibovespa e S&P 500: pela NOSSA API (/api/cotacao), usando os ETFs
//   BOVA11 (copia o Ibovespa) e IVVB11 (copia o S&P 500)
// - Dólar: AwesomeAPI (grátis, sem chave)
// - Bitcoin: CoinGecko (grátis, sem chave)
// =========================================================

// Formata um número como dinheiro brasileiro: 5.41 → "R$ 5,41"
function formatarReais(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Formata uma variação em %: 1.234 → "+1,23%" e -0.5 → "-0,50%"
function formatarPercentual(valor) {
    const sinal = valor > 0 ? "+" : "";
    const numero = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sinal}${numero}%`;
}

// Mostra a variação num elemento e pinta de verde (alta) ou vermelho (baixa).
// As classes "positivo" e "negativo" já existem no CSS (com as setas ▲ ▼)
function mostrarVariacao(elemento, variacao) {
    elemento.textContent = formatarPercentual(variacao);
    elemento.classList.remove("positivo", "negativo");
    if (variacao > 0) {
        elemento.classList.add("positivo");
    } else if (variacao < 0) {
        elemento.classList.add("negativo");
    }
}

// Busca um endereço e devolve o JSON; se a resposta vier com erro, lança um erro
async function buscarJSON(endereco) {
    const resposta = await fetch(endereco);
    if (!resposta.ok) {
        throw new Error(`A API respondeu com o código ${resposta.status}`);
    }
    return resposta.json();
}

// ---------------------------------------------------------
// Ibovespa e S&P 500: variação do dia pela nossa API
// ---------------------------------------------------------
async function buscarIndice(ativo, idElemento) {
    const elemento = document.getElementById(idElemento);
    try {
        const dados = await buscarJSON(`/api/cotacao?ativo=${ativo}`);
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

    // A brapi grátis aceita 1 consulta por vez: buscamos os dois ETFs um depois do outro
    await buscarIndice("BOVA11", "ibovespa-variacao");
    await buscarIndice("IVVB11", "sp500-variacao");

    mostrarHorario();
}

carregarMercado();
