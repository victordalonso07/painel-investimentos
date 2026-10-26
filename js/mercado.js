// =========================================================
// MERCADO: cotações reais
// Busca o dólar na AwesomeAPI (grátis, sem chave) e mostra na página.
// =========================================================

// Endereço da API: dólar (USD) em reais (BRL)
const URL_DOLAR = "https://economia.awesomeapi.com.br/json/last/USD-BRL";


// Onde o valor do dólar aparece na página
const elementoDolar = document.getElementById("cotacao-dolar")


// Formata um número como dinheiro brasileiro: 5.41 → "R$ 5,41"
function formatarReais(valor) {
    return valor.toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
}

// async: avisa que esta função vai esperar coisas que demoram (a internet)
async function buscarDolar() {
try {
    // fetch: faz o pedido à API; await: espera a resposta chegar
    const resposta = await fetch(URL_DOLAR);

     // Se a API respondeu com erro (ex.: 404, 429, 500), para aqui e vai para o catch
     if (!resposta.ok) {
        throw new Error(`A api respondeu com o código ${resposta.status}`);
     }
    
    // Transforma o texto JSON da resposta em um objeto do JavaScript
    const dados = await resposta.json();

    // Pega o valor de compra do dólar ("bid") e converte de texto para número
    const valorDolar = Number(dados.USDBRL.bid)

    // Mostra na página, formatado como dinheiro
    elementoDolar.textContent = formatarReais(valorDolar)
}catch (erro) {
    // Qualquer falha (sem internet, API fora do ar...) cai aqui
    elementoDolar.textContent = "Indisponível";
    console.error("falha ao buscar o dolár:", erro)
}
}

// Chama a função assim que o arquivo carregar
buscarDolar();