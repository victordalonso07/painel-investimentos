// =========================================================
// CARTEIRA: compras salvas no banco (Supabase)
// - Ao abrir a página: GET /api/operacoes → desenha a lista
// - Ao enviar o formulário: POST /api/operacoes → grava e redesenha
// O navegador nunca fala direto com o banco: sempre pela nossa API.
// =========================================================

// Acha os elementos da página pelo id
const formCompra = document.getElementById("form-compra");
const listaPosicoes = document.getElementById("lista-posicoes");
const resumoCarteira = document.getElementById("resumo-carteira");
const mensagem = document.getElementById("mensagem-cadastro");
const botaoAdicionar = document.getElementById("botao-adicionar");


// Formata um número como dinheiro brasileiro: 385 → "R$ 385,00"
function formatarReais(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Formata a quantidade sem arredondar demais: 0.0004 → "0,0004"
function formatarQuantidade(valor) {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

// O banco guarda a data como "2026-10-01"; na tela mostramos "01/10/2026"
function formatarData(texto) {
    const [ano, mes, dia] = texto.split("-");
    return `${dia}/${mes}/${ano}`;
}

// Mostra uma mensagem abaixo do botão (verde com ✓, ou vermelha com ✕ se for erro)
function mostrarMensagem(texto, ehErro) {
    mensagem.textContent = texto;
    mensagem.classList.toggle("erro", ehErro);
}


// ---------------------------------------------------------
// Cria o <li> de UMA operação (a mesma estrutura de antes)
// ---------------------------------------------------------
function criarItem(operacao) {
    // O banco devolve números como texto em alguns casos: Number() garante que é número
    const quantidade = Number(operacao.quantidade);
    const preco = Number(operacao.preco_unitario);

    const item = document.createElement("li");

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

    // textContent: o navegador trata como texto, nunca como código (protege contra XSS)
    item.querySelector("h3").textContent = operacao.ativo;
    item.querySelector(".tipo").textContent = operacao.tipo_ativo;
    item.querySelector(".campo-quantidade").textContent = formatarQuantidade(quantidade);
    item.querySelector(".campo-preco").textContent = formatarReais(preco);
    item.querySelector(".campo-total").textContent = formatarReais(quantidade * preco);
    item.querySelector(".campo-data").textContent = formatarData(operacao.data_operacao);

    return item;
}


// ---------------------------------------------------------
// GET: busca todas as operações e desenha a lista
// ---------------------------------------------------------
async function carregarOperacoes() {
    try {
        // fetch sem "method" = GET
        const resposta = await fetch("/api/operacoes");
        if (!resposta.ok) {
            throw new Error(`A API respondeu com o código ${resposta.status}`);
        }
        const operacoes = await resposta.json();

        // Limpa a lista e desenha de novo, uma operação por vez
        listaPosicoes.innerHTML = "";
        let totalInvestido = 0;
        for (const operacao of operacoes) {
            listaPosicoes.appendChild(criarItem(operacao));
            totalInvestido += Number(operacao.quantidade) * Number(operacao.preco_unitario);
        }

        // Resumo no topo
        if (operacoes.length === 0) {
            resumoCarteira.textContent = "Nenhuma compra cadastrada ainda. Use o formulário para adicionar a primeira.";
        } else {
            resumoCarteira.textContent =
                `${operacoes.length} compra(s) cadastrada(s). Total investido: ${formatarReais(totalInvestido)}.`;
        }
    } catch (erro) {
        resumoCarteira.textContent = "Não foi possível carregar suas compras. Tente recarregar a página.";
        console.error("Falha ao carregar operações:", erro);
    }
}


// ---------------------------------------------------------
// POST: quando o formulário for enviado, grava no banco
// ---------------------------------------------------------
formCompra.addEventListener("submit", async (evento) => {
    // Impede o comportamento padrão: recarregar a página
    evento.preventDefault();

    // Monta o objeto com os MESMOS nomes das colunas da tabela "operacoes"
    const novaOperacao = {
        tipo_operacao: "compra",
        ativo: document.getElementById("ativo").value.trim().toUpperCase(),
        tipo_ativo: document.getElementById("tipo").value,
        quantidade: Number(document.getElementById("quantidade").value),
        preco_unitario: Number(document.getElementById("preco").value),
        data_operacao: document.getElementById("data").value,
    };

    // Desliga o botão enquanto salva: evita gravar duas vezes com clique duplo
    botaoAdicionar.disabled = true;
    mostrarMensagem("", false);

    try {
        const resposta = await fetch("/api/operacoes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },  // avisa: o corpo é JSON
            body: JSON.stringify(novaOperacao),               // objeto → texto
        });

        // Lê a resposta (a operação criada, ou { erro: "..." })
        const dados = await resposta.json();

        if (!resposta.ok) {
            // A API explica o problema (ex.: "A data não pode ser no futuro.")
            mostrarMensagem(dados.erro ?? "Não foi possível salvar.", true);
            return;
        }

        // Deu certo (201): limpa o formulário e redesenha a lista com o que está no banco
        formCompra.reset();
        document.getElementById("ativo").focus();
        mostrarMensagem(`${dados.ativo} cadastrado com sucesso.`, false);
        await carregarOperacoes();
    } catch (erro) {
        mostrarMensagem("Falha de conexão. Verifique a internet e tente de novo.", true);
        console.error("Falha ao salvar operação:", erro);
    } finally {
        // "finally" roda sempre, com sucesso ou erro: religa o botão
        botaoAdicionar.disabled = false;
    }
});


// Começa: busca as compras assim que a página abre
carregarOperacoes();
