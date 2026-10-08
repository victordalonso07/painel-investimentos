// =========================================================
// TEMA CLARO / ESCURO
// 1. Ao abrir a página: descobre qual tema usar e aplica.
// 2. Ao clicar no botão: troca o tema e guarda a escolha.
// =========================================================

// Nome da "gaveta" onde o navegador guarda a escolha do tema
const CHAVE_TEMA = "tema";

// Lê o tema salvo. O try/catch evita erro em navegadores que
// bloqueiam o armazenamento (ex.: janela anônima em alguns casos).
function lerTemaSalvo() {
  try {
    return localStorage.getItem(CHAVE_TEMA);
  } catch {
    return null;
  }
}

function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Se não der para salvar, o tema funciona igual, só não é lembrado
  }
}

// Se nunca escolheu, segue a preferência do sistema (celular/PC no escuro?)
function temaInicial() {
  const salvo = lerTemaSalvo();
  if (salvo) return salvo;

  const sistemaEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return sistemaEscuro ? "escuro" : "claro";
}

// Aplica o tema: marca a tag <html> com data-tema="claro" ou "escuro".
// O CSS olha essa marca para decidir as cores.
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;

  const botao = document.getElementById("botao-tema");
  if (botao) {
    const escuro = tema === "escuro";
    botao.textContent = escuro ? "Modo claro" : "Modo escuro";
    botao.setAttribute("aria-pressed", String(escuro)); // para leitores de tela
  }
}

// --- Passo 1: roda imediatamente, antes da página aparecer ---
aplicarTema(temaInicial());

// --- Passo 2: quando o HTML terminar de carregar, liga o botão ---
document.addEventListener("DOMContentLoaded", () => {
  const botao = document.getElementById("botao-tema");

  aplicarTema(document.documentElement.dataset.tema); // ajusta o texto do botão

  botao.addEventListener("click", () => {
    const atual = document.documentElement.dataset.tema;
    const novo = atual === "escuro" ? "claro" : "escuro";
    aplicarTema(novo);
    salvarTema(novo);
  });
});
