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

    // Teste: mostra uma mensagem no console do navegador
    console.log("Formulário enviado!");
});