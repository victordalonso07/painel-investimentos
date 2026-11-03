// =========================================================
// RENDIMENTO (página Carteira): desenha as POSIÇÕES com o resultado
// - Posição = tudo que você tem de um mesmo ativo (várias compras somadas)
// - Cálculo e busca de preços ficam no js/comum.js
// Usado pelo js/carteira.js (este arquivo carrega antes dele).
// =========================================================

// Controle de "qual carregamento é o mais recente".
// Se a lista for recarregada no meio da busca de preços, a busca antiga para de mexer na tela
let cargaAtual = 0;


// Um <li> por posição, com os preços "Carregando…"
function criarItemPosicao(posicao) {
    const item = document.createElement("li");
    item.innerHTML = `
        <article class="posicao posicao-resumo">
            <div class="posicao-nome">
                <h3></h3>
                <p class="tipo"></p>
            </div>
            <dl>
                <div><dt>Quantidade</dt><dd class="campo-quantidade"></dd></div>
                <div><dt>Preço médio</dt><dd class="campo-preco-medio"></dd></div>
                <div><dt>Total investido</dt><dd class="campo-investido"></dd></div>
                <div><dt>Preço atual</dt><dd class="campo-preco-atual">Carregando…</dd></div>
                <div><dt>Valor atual</dt><dd class="campo-valor-atual">Carregando…</dd></div>
                <div><dt>Resultado</dt><dd class="campo-resultado">Carregando…</dd></div>
            </dl>
        </article>
    `;
    item.querySelector("h3").textContent = posicao.ativo;
    item.querySelector(".tipo").textContent = posicao.tipo;
    item.querySelector(".campo-quantidade").textContent = formatarQuantidade(posicao.quantidade);
    item.querySelector(".campo-preco-medio").textContent = formatarReais(posicao.precoMedio);
    item.querySelector(".campo-investido").textContent = formatarReais(posicao.custo);
    // Botão "Ver gráfico" (js/grafico.js)
    item.querySelector("article").appendChild(criarBotaoGrafico({ ativo: posicao.ativo, tipo: posicao.tipo }));
    return item;
}


// Desenha as posições e vai preenchendo os preços conforme chegam
async function atualizarPosicoes(operacoes, listaPosicoes, resumoCarteira) {
    const minhaCarga = ++cargaAtual;
    const posicoes = calcularPosicoes(operacoes);

    listaPosicoes.innerHTML = "";
    if (posicoes.length === 0) {
        resumoCarteira.textContent = "Nenhuma posição aberta. Use o formulário para cadastrar a primeira compra.";
        return;
    }

    const itens = new Map();   // ativo → <li>, para preencher o preço depois
    for (const posicao of posicoes) {
        const item = criarItemPosicao(posicao);
        itens.set(posicao.ativo, item);
        listaPosicoes.appendChild(item);
    }

    const totalInvestido = posicoes.reduce((soma, p) => soma + p.custo, 0);
    resumoCarteira.textContent = `Total investido: ${formatarReais(totalInvestido)}. Buscando cotações…`;

    let valorAtualTotal = 0;
    let semCotacao = 0;

    await cotarPosicoes(posicoes, (posicao, cotacao) => {
        if (minhaCarga !== cargaAtual) return;   // a lista foi recarregada: esta busca ficou velha
        const item = itens.get(posicao.ativo);

        if (!cotacao || typeof cotacao.preco !== "number") {
            item.querySelector(".campo-preco-atual").textContent = "Sem cotação";
            item.querySelector(".campo-valor-atual").textContent = "—";
            item.querySelector(".campo-resultado").textContent = "—";
            valorAtualTotal += posicao.custo;   // sem preço: conta pelo valor investido
            semCotacao++;
            return;
        }

        const valorAtual = posicao.quantidade * cotacao.preco;
        const resultado = valorAtual - posicao.custo;
        const campoResultado = item.querySelector(".campo-resultado");
        item.querySelector(".campo-preco-atual").textContent = formatarReais(cotacao.preco);
        item.querySelector(".campo-valor-atual").textContent = formatarReais(valorAtual);
        campoResultado.textContent = formatarResultado(resultado, posicao.custo);
        pintarSinal(campoResultado, resultado);
        valorAtualTotal += valorAtual;
    });

    if (minhaCarga !== cargaAtual) return;

    // Resumo final
    resumoCarteira.textContent =
        `Total investido: ${formatarReais(totalInvestido)}. ` +
        `Valor atual: ${formatarReais(valorAtualTotal)}. ` +
        `Resultado: ${formatarResultado(valorAtualTotal - totalInvestido, totalInvestido)}.` +
        (semCotacao > 0 ? ` ${semCotacao} ativo(s) sem cotação entram pelo valor investido.` : "");
}
