// =========================================================
// CARTEIRA: compras e vendas salvas no banco (Supabase)
// - Ao abrir a página: GET /api/operacoes → desenha posições (rendimento.js) e histórico
// - Ao enviar o formulário: POST /api/operacoes → grava e redesenha
// - Botão Editar: PATCH /api/operacoes?id=... → corrige e redesenha
// - Botão Excluir: DELETE /api/operacoes?id=... → apaga e redesenha
// O navegador nunca fala direto com o banco: sempre pela nossa API.
// =========================================================

// Acha os elementos da página pelo id
const formCompra = document.getElementById("form-compra");
const listaPosicoes = document.getElementById("lista-posicoes");     // posições (com rendimento)
const listaOperacoes = document.getElementById("lista-operacoes");   // histórico (cada compra)
const resumoCarteira = document.getElementById("resumo-carteira");
const mensagem = document.getElementById("mensagem-cadastro");
const botaoAdicionar = document.getElementById("botao-adicionar");


// (formatarReais, formatarQuantidade e formatarData estão no js/comum.js)

// Última lista carregada do banco (usada para conferir se uma venda é possível)
let ultimasOperacoes = [];

// "compra" → "Compra", "venda" → "Venda"
function nomeOperacaoDe(operacao) {
    return operacao.tipo_operacao === "venda" ? "Venda" : "Compra";
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
                <div><dt>Preço</dt><dd class="campo-preco"></dd></div>
                <div><dt>Total</dt><dd class="campo-total"></dd></div>
                <div><dt>Data</dt><dd class="campo-data"></dd></div>
            </dl>
            <button type="button" class="botao-editar">Editar</button>
            <button type="button" class="botao-excluir">Excluir</button>
        </article>
    `;

    // textContent: o navegador trata como texto, nunca como código (protege contra XSS)
    item.querySelector("h3").textContent = operacao.ativo;
    // Ex.: "Compra · Ação" ou "Venda · FII"
    const nomeOperacao = nomeOperacaoDe(operacao);
    item.querySelector(".tipo").textContent = `${nomeOperacao} · ${operacao.tipo_ativo}`;
    item.querySelector(".campo-quantidade").textContent = formatarQuantidade(quantidade);
    item.querySelector(".campo-preco").textContent = formatarReais(preco);
    item.querySelector(".campo-total").textContent = formatarReais(quantidade * preco);
    item.querySelector(".campo-data").textContent = formatarData(operacao.data_operacao);

    // Botão Excluir: o primeiro clique pede confirmação, o segundo apaga
    const botaoExcluir = item.querySelector(".botao-excluir");
    botaoExcluir.setAttribute("aria-label", `Excluir ${nomeOperacao.toLowerCase()} de ${operacao.ativo}`);
    botaoExcluir.addEventListener("click", () => excluirOperacao(operacao, botaoExcluir));

    // Botão Editar: leva os dados desta operação para o formulário
    const botaoEditar = item.querySelector(".botao-editar");
    botaoEditar.setAttribute("aria-label", `Editar ${nomeOperacao.toLowerCase()} de ${operacao.ativo}`);
    botaoEditar.addEventListener("click", () => iniciarEdicao(operacao, item));
    if (String(operacao.id) === String(editandoId)) item.querySelector("article").classList.add("em-edicao");

    return item;
}


// ---------------------------------------------------------
// GET: busca todas as operações e desenha a lista
// ---------------------------------------------------------
async function carregarOperacoes() {
    try {
        const operacoes = await buscarOperacoes();   // GET (js/comum.js)
        ultimasOperacoes = operacoes;                // guardadas para conferir vendas

        // Histórico: limpa e desenha de novo, uma operação por vez
        listaOperacoes.innerHTML = "";
        for (const operacao of operacoes) {
            listaOperacoes.appendChild(criarItem(operacao));
        }

        // Posições e rendimento (js/rendimento.js): sem "await", para o histórico
        // aparecer logo enquanto as cotações ainda estão chegando
        atualizarPosicoes(operacoes, listaPosicoes, resumoCarteira).then(mostrarHorario);
    } catch (erro) {
        resumoCarteira.textContent = "Não foi possível carregar suas compras. Tente recarregar a página.";
        console.error("Falha ao carregar operações:", erro);
    }
}


// ---------------------------------------------------------
// DELETE: apaga uma operação (com confirmação em dois cliques)
// ---------------------------------------------------------
async function excluirOperacao(operacao, botao) {
    // 1º clique: só troca o texto e espera a confirmação.
    // "dataset.confirmando" guarda um estado no próprio botão (vira data-confirmando no HTML)
    if (botao.dataset.confirmando !== "sim") {
        botao.dataset.confirmando = "sim";
        botao.textContent = "Confirmar exclusão";
        // Se não confirmar em 4 segundos, volta ao normal
        setTimeout(() => {
            botao.dataset.confirmando = "";
            botao.textContent = "Excluir";
        }, 4000);
        return;
    }

    // 2º clique: apaga de verdade
    botao.disabled = true;
    try {
        // O id vai no endereço; encodeURIComponent garante que ele não "quebre" o endereço
        const resposta = await fetch(`/api/operacoes?id=${encodeURIComponent(operacao.id)}`, {
            method: "DELETE",
        });
        if (!resposta.ok) {
            const dados = await resposta.json().catch(() => ({}));
            // Ex.: "Não dá: a quantidade de PETR4 ficaria negativa..." (venda feita depois desta compra)
            mostrarMensagem(dados.erro ?? "Não foi possível excluir. Tente de novo.", true);
            botao.disabled = false;
            return;
        }
        if (String(operacao.id) === String(editandoId)) cancelarEdicao();
        mostrarMensagem(`${nomeOperacaoDe(operacao)} de ${operacao.ativo} excluída.`, false);
        await carregarOperacoes();
    } catch (erro) {
        mostrarMensagem("Não foi possível excluir. Tente de novo.", true);
        console.error("Falha ao excluir operação:", erro);
        botao.disabled = false;
    }
}


// ---------------------------------------------------------
// EDITAR: o mesmo formulário serve para cadastrar e para corrigir
// editandoId = null → cadastrando; um número → editando essa operação
// ---------------------------------------------------------
let editandoId = null;
const tituloCadastro = document.getElementById("titulo-cadastro");
const botaoCancelarEdicao = document.getElementById("botao-cancelar-edicao");

function iniciarEdicao(operacao, item) {
    editandoId = operacao.id;

    // Preenche cada campo com o que está salvo
    document.getElementById("operacao").value = operacao.tipo_operacao;
    escolherAtivo(formCompra, operacao.tipo_ativo, operacao.ativo);   // js/comum.js
    document.getElementById("quantidade").value = Number(operacao.quantidade);
    document.getElementById("preco").value = Number(operacao.preco_unitario);
    document.getElementById("taxas").value = Number(operacao.taxas ?? 0) || "";
    document.getElementById("data").value = operacao.data_operacao;

    // Muda a "cara" do formulário para o modo edição
    tituloCadastro.textContent = `Editar ${nomeOperacaoDe(operacao).toLowerCase()} de ${operacao.ativo}`;
    botaoAdicionar.textContent = "Salvar alteração";
    botaoCancelarEdicao.hidden = false;
    mostrarMensagem("", false);

    // Destaca o cartão que está sendo editado
    for (const cartao of listaOperacoes.querySelectorAll(".em-edicao")) cartao.classList.remove("em-edicao");
    item.querySelector("article").classList.add("em-edicao");

    // No celular o formulário fica lá embaixo: rola até ele
    formCompra.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("quantidade").focus({ preventScroll: true });
}

function cancelarEdicao() {
    editandoId = null;
    tituloCadastro.textContent = "Cadastrar operação";
    botaoAdicionar.textContent = "Adicionar";
    botaoCancelarEdicao.hidden = true;
    formCompra.reset();
    for (const cartao of listaOperacoes.querySelectorAll(".em-edicao")) cartao.classList.remove("em-edicao");
}

botaoCancelarEdicao.addEventListener("click", () => {
    cancelarEdicao();
    mostrarMensagem("", false);
});


// ---------------------------------------------------------
// POST: quando o formulário for enviado, grava no banco
// ---------------------------------------------------------
formCompra.addEventListener("submit", async (evento) => {
    // Impede o comportamento padrão: recarregar a página
    evento.preventDefault();

    // Monta o objeto com os MESMOS nomes das colunas da tabela "operacoes"
    const novaOperacao = {
        tipo_operacao: document.getElementById("operacao").value,
        ativo: lerAtivo(formCompra),
        tipo_ativo: document.getElementById("tipo").value,
        quantidade: Number(document.getElementById("quantidade").value),
        preco_unitario: Number(document.getElementById("preco").value),
        taxas: Number(document.getElementById("taxas").value || 0),   // vazio = 0
        data_operacao: document.getElementById("data").value,
    };

    // Venda: confere antes se você tem essa quantidade (o servidor confere de novo).
    // Na edição, a própria operação que está sendo editada não entra na conta
    if (novaOperacao.tipo_operacao === "venda") {
        const outras = ultimasOperacoes.filter((op) => String(op.id) !== String(editandoId));
        const posicao = calcularPosicoes(outras).find((p) => p.ativo === novaOperacao.ativo);
        if (!posicao) {
            mostrarMensagem(`Você não tem ${novaOperacao.ativo} na carteira para vender.`, true);
            return;
        }
        if (novaOperacao.quantidade > posicao.quantidade + 1e-9) {
            mostrarMensagem(`Você tem só ${formatarQuantidade(posicao.quantidade)} de ${novaOperacao.ativo}.`, true);
            return;
        }
        novaOperacao.tipo_ativo = posicao.tipo;   // a venda usa o mesmo tipo da compra
    }

    // Desliga o botão enquanto salva: evita gravar duas vezes com clique duplo
    botaoAdicionar.disabled = true;
    mostrarMensagem("", false);

    try {
        // Cadastro novo = POST em /api/operacoes; edição = PATCH em /api/operacoes?id=12
        const editando = editandoId !== null;
        const resposta = await fetch(editando ? `/api/operacoes?id=${encodeURIComponent(editandoId)}` : "/api/operacoes", {
            method: editando ? "PATCH" : "POST",
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

        // Deu certo: limpa o formulário e redesenha a lista com o que está no banco
        if (editando) cancelarEdicao();
        formCompra.reset();
        focarAtivo(formCompra);
        mostrarMensagem(`${nomeOperacaoDe(dados)} de ${dados.ativo} ${editando ? "alterada" : "cadastrada"}.`, false);
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

// Lista de ativos por tipo, com "Outro (digitar)" (js/comum.js)
configurarSeletorAtivo(formCompra);
