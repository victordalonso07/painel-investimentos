// =========================================================
// OBSERVAÇÃO: ativos que você acompanha sem ter na carteira
// - Ao abrir: GET /api/observacao → desenha a lista e busca os preços
// - Formulário: POST (adiciona)
// - Caixa "Mostrar no Início": PATCH (muda só essa informação)
// - Botão Remover: DELETE
// =========================================================

const formObservacao = document.getElementById("form-observacao");
const listaObservacao = document.getElementById("lista-observacao");
const resumoObservacao = document.getElementById("resumo-observacao");
const mensagemObservacao = document.getElementById("mensagem-observacao");
const botaoAdicionarObs = document.getElementById("botao-adicionar");

function mostrarMensagemObs(texto, ehErro) {
    mensagemObservacao.textContent = texto;
    mensagemObservacao.classList.toggle("erro", ehErro);
}

// Envia um pedido com corpo em JSON e devolve { ok, dados }
async function enviarJSON(endereco, metodo, corpo) {
    const resposta = await fetch(endereco, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => ({}));
    return { ok: resposta.ok, dados: dados };
}


// ---------------------------------------------------------
// Um <li> por ativo
// ---------------------------------------------------------
function criarItemObservacao(registro) {
    const item = document.createElement("li");
    item.innerHTML = `
        <article class="posicao">
            <div class="posicao-nome">
                <h3></h3>
                <p class="tipo"></p>
            </div>
            <dl>
                <div><dt>Preço atual</dt><dd class="campo-preco">Carregando…</dd></div>
                <div><dt>Variação hoje</dt><dd class="campo-variacao">—</dd></div>
            </dl>
            <div class="acoes-item">
                <label class="opcao-inicio">
                    <input type="checkbox" class="caixa-inicio">
                    Mostrar no Início
                </label>
                <button type="button" class="botao-excluir">Remover</button>
            </div>
        </article>
    `;
    item.querySelector("h3").textContent = registro.ativo;
    item.querySelector(".tipo").textContent = registro.tipo_ativo;

    // Caixa "Mostrar no Início": cada clique grava a escolha no banco (PATCH)
    const caixa = item.querySelector(".caixa-inicio");
    caixa.checked = registro.mostrar_inicio;
    caixa.addEventListener("change", async () => {
        caixa.disabled = true;
        try {
            const { ok } = await enviarJSON(`/api/observacao?id=${registro.id}`, "PATCH", {
                mostrar_inicio: caixa.checked,
            });
            if (!ok) throw new Error("A API recusou a alteração");
            mostrarMensagemObs(
                caixa.checked ? `${registro.ativo} vai aparecer no Início.` : `${registro.ativo} saiu do Início.`,
                false
            );
        } catch (erro) {
            caixa.checked = !caixa.checked;   // volta como estava
            mostrarMensagemObs("Não foi possível salvar a escolha.", true);
            console.error(erro);
        } finally {
            caixa.disabled = false;
        }
    });

    // Remover: 1º clique pede confirmação, 2º apaga (mesma ideia da Carteira)
    const botao = item.querySelector(".botao-excluir");
    botao.setAttribute("aria-label", `Remover ${registro.ativo} da lista`);
    botao.addEventListener("click", async () => {
        if (botao.dataset.confirmando !== "sim") {
            botao.dataset.confirmando = "sim";
            botao.textContent = "Confirmar";
            setTimeout(() => {
                botao.dataset.confirmando = "";
                botao.textContent = "Remover";
            }, 4000);
            return;
        }
        botao.disabled = true;
        const resposta = await fetch(`/api/observacao?id=${registro.id}`, { method: "DELETE" });
        if (resposta.ok) {
            mostrarMensagemObs(`${registro.ativo} removido da lista.`, false);
            await carregarObservacao();
        } else {
            mostrarMensagemObs("Não foi possível remover. Tente de novo.", true);
            botao.disabled = false;
        }
    });

    return item;
}


// ---------------------------------------------------------
// GET: carrega a lista e busca os preços
// ---------------------------------------------------------
async function carregarObservacao() {
    let registros;
    try {
        registros = await buscarObservacao();
    } catch (erro) {
        resumoObservacao.textContent = "Não foi possível carregar a lista. Tente recarregar a página.";
        console.error("Falha ao carregar a observação:", erro);
        return;
    }

    listaObservacao.innerHTML = "";
    if (registros.length === 0) {
        resumoObservacao.textContent = "Sua lista está vazia. Use o formulário para acompanhar um ativo.";
        return;
    }
    resumoObservacao.textContent = `${registros.length} ativo(s) em observação.`;

    const itens = new Map();
    for (const registro of registros) {
        const item = criarItemObservacao(registro);
        itens.set(registro.ativo, item);
        listaObservacao.appendChild(item);
    }

    // cotarPosicoes (js/comum.js) só precisa de { ativo, tipo }
    const ativos = registros.map((r) => ({ ativo: r.ativo, tipo: r.tipo_ativo }));
    await cotarPosicoes(ativos, (ativo, cotacao) => {
        const item = itens.get(ativo.ativo);
        if (!item) return;
        const campoPreco = item.querySelector(".campo-preco");
        const campoVariacao = item.querySelector(".campo-variacao");
        if (!cotacao || typeof cotacao.preco !== "number") {
            campoPreco.textContent = "Sem cotação";
            return;
        }
        campoPreco.textContent = formatarReais(cotacao.preco);
        if (typeof cotacao.variacao === "number") {
            campoVariacao.textContent = formatarPercentual(cotacao.variacao);
            pintarSinal(campoVariacao, cotacao.variacao);
        }
    });
    mostrarHorario();
}


// ---------------------------------------------------------
// POST: adicionar ativo
// ---------------------------------------------------------
formObservacao.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    botaoAdicionarObs.disabled = true;
    mostrarMensagemObs("", false);

    try {
        const { ok, dados } = await enviarJSON("/api/observacao", "POST", {
            ativo: lerAtivo(formObservacao),
            tipo_ativo: document.getElementById("tipo").value,
        });
        if (!ok) {
            mostrarMensagemObs(dados.erro ?? "Não foi possível adicionar.", true);   // ex.: "VALE3 já está na lista."
            return;
        }
        formObservacao.reset();
        focarAtivo(formObservacao);
        mostrarMensagemObs(`${dados.ativo} adicionado à lista.`, false);
        await carregarObservacao();
    } catch (erro) {
        mostrarMensagemObs("Falha de conexão. Verifique a internet e tente de novo.", true);
        console.error("Falha ao adicionar:", erro);
    } finally {
        botaoAdicionarObs.disabled = false;
    }
});

carregarObservacao();

// Lista de ativos por tipo, com "Outro (digitar)" (js/comum.js)
configurarSeletorAtivo(formObservacao);
