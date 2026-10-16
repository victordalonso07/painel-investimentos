// =========================================================
// MERCADO: cotações reais
// Busca o dólar na AwesomeAPI (grátis, sem chave) e mostra na página.
// =========================================================

// Endereço da API: dólar (USD) em reais (BRL)
const URL_DOLAR = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

// async: avisa que esta função vai esperar coisas que demoram (a internet)
async function buscarDolar() {
    // fetch: faz o pedido à API; await: espera a resposta chegar
    const resposta = await fetch(URL_DOLAR);
    
    // Transforma o texto JSON da resposta em um objeto do JavaScript
    const dados = await resposta.json();
}

// Chama a função assim que o arquivo carregar
buscarDolar();