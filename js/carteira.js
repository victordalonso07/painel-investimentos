// =========================================================
// CARTEIRA: cadastrar compra
// Ao enviar o formulário, adiciona a compra na lista da tela.
// (Por enquanto não salva: some ao recarregar a página.)
// =========================================================

// Acha o formulário e a lista pelo id
const formCompra = document.getElementById("form-compra");
const listaPosicoes = document.getElementById("lista-posicoes");

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

    // Teste: mostra tudo no console
    console.log(ativo, tipo, quantidade, preco, data, totalInvestido)
});