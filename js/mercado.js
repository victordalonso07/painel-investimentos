// =========================================================
// MERCADO: cotações reais na página Início
// - Ibovespa e S&P 500: pela NOSSA API (/api/cotacao): o índice em pontos (^BVSP, ^GSPC)
//   ou, se não vier, os ETFs BOVA11 e IVVB11, que copiam esses índices
// - Dólar: AwesomeAPI (grátis, sem chave)
// - Bitcoin: CoinGecko (grátis, sem chave)
// =========================================================

// (formatarReais, formatarPercentual, buscarCotacaoB3 e mostrarHorario estão no js/comum.js)

// Mostra a variação num elemento e pinta de verde (alta) ou vermelho (baixa).
// As classes "positivo" e "negativo" já existem no CSS (com as setas ▲ ▼)
function mostrarVariacao(elemento, variacao) {
    elemento.textContent = formatarPercentual(variacao);
    pintarSinal(elemento, variacao);
}

// ---------------------------------------------------------
// Ibovespa e S&P 500: valor e variação do dia pela nossa API
// Tenta primeiro o ÍNDICE (em pontos). Se a brapi não liberar o índice
// no plano grátis, usa o ETF que copia o índice (preço em reais).
// ---------------------------------------------------------
async function buscarIndice(tentativas, prefixoId) {
    const elementoValor = document.getElementById(`${prefixoId}-valor`);
    const elementoVariacao = document.getElementById(`${prefixoId}-variacao`);
    const elementoFonte = document.getElementById(`${prefixoId}-fonte`);

    for (const tentativa of tentativas) {
        try {
            const dados = await buscarCotacaoB3(tentativa.ativo);   // entra na fila da brapi
            if (typeof dados.preco !== "number") throw new Error("Resposta sem preço");

            // Índice: "128.450 pts"; ETF: "R$ 128,45"
            elementoValor.textContent = tentativa.emPontos
                ? `${dados.preco.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pts`
                : formatarReais(dados.preco);
            mostrarVariacao(elementoVariacao, dados.variacao);
            elementoFonte.textContent = tentativa.emPontos ? "" : `(via ${tentativa.ativo})`;
            return;   // deu certo: não precisa tentar a próxima
        } catch (erro) {
            console.warn(`Falha ao buscar ${tentativa.ativo}, tentando a próxima opção:`, erro);
        }
    }
    elementoValor.textContent = "Indisponível";
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
// Começa tudo assim que o arquivo carregar
// ---------------------------------------------------------
async function carregarMercado() {
    // Dólar e Bitcoin vêm de APIs diferentes: podem ser buscados ao mesmo tempo
    buscarDolar();
    buscarBitcoin();

    // Entram na fila da brapi (1 consulta por vez, ver js/comum.js)
    await Promise.all([
        buscarIndice([{ ativo: "^BVSP", emPontos: true }, { ativo: "BOVA11", emPontos: false }], "ibovespa"),
        buscarIndice([{ ativo: "^GSPC", emPontos: true }, { ativo: "IVVB11", emPontos: false }], "sp500"),
    ]);

    mostrarHorario();
}

carregarMercado();
