// =========================================================
// CARTEIRA: cadastrar compra
// Ao enviar o formulário, adiciona a compra na lista da tela.
// (Por enquanto não salva: some ao recarregar a página.)
// =========================================================

// Acha o formulário e a lista pelo id
const formCompra = document.getElementById("form-compra");
const listaPosicoes = document.getElementById("lista-posicoes");


// Formata um número como dinheiro brasileiro: 385 → "R$ 385,00"
function formatarReais(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL"});
}


// Quando o formulário for enviado (clique no botão ou Enter)...
formCompra.addEventListener("submit", (evento) => {
    // ...impede o comportamento padrão: recarregar a página
    evento.preventDefault();

    // Lê o que foi digitado em cada campo
    const ativo = document.getElementById("ativo").value.trim().toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const quantidade = Number(document.getElementById("quantidade").value);
    const preco = Number(document.getElementById("preco").value);
    const data = document.getElementById("data").value;

    // Calcula quanto foi investido nessa compra
    const totalInvestido = quantidade * preco;

    // Cria um item novo para a lista (um <li> vazio)
    const item = document.createElement("li");

    // Monta a estrutura do item, igual à dos que já estão no HTML
    item.innerHTML = `
        <article class="posicao">
            <div class="posicao-nome">
                <h3></h3>
                <p class="tipo"></p>
            </div>
            <dl>
                <div><dt>Quantidade</dt><dd class="campo-quantidade"></dd></div>
                <div><dt>Preço pago</dt><dd class="campo-preco"></dd></div>
                <div><dt>Total investido</dt><dd class="campo-total"></dd></div>
                <div><dt>Data da compra</dt><dd class="campo-data"></dd></div>
            </dl>
        </article>
    `;

    
});