// =========================================================
// INÍCIO: resumo, destaques e carteira com dados reais
// 1. Busca as operações no banco e junta em posições (js/comum.js)
// 2. Busca a cotação de cada ativo
// 3. Preenche: patrimônio, ganho de hoje, rendimento total,
//    a lista "Minha carteira" e os 3 destaques do dia
// =========================================================

const campoPatrimonio = document.getElementById("resumo-patrimonio");
const campoHoje = document.getElementById("resumo-hoje");
const campoRendimento = document.getElementById("resumo-rendimento");
const listaCarteira = document.getElementById("inicio-carteira");
const avisoCarteiraVazia = document.getElementById("inicio-carteira-vazia");
const listaDestaques = document.getElementById("lista-destaques");
const avisoDestaquesVazio = document.getElementById("destaques-vazio");


// Um <li> da lista "Minha carteira": valor atual e variação do dia
function criarItemCarteira(posicao) {
    const item = document.createElement("li");
    item.innerHTML = `
        <article class="ativo">
            <h3></h3>
            <p class="tipo"></p>
            <dl>
                <dt>Valor atual</dt>
                <dd class="campo-valor">Carregando…</dd>
                <dt>Variação</dt>
                <dd class="campo-variacao">—</dd>
            </dl>
        </article>
    `;
    item.querySelector("h3").textContent = posicao.ativo;
    item.querySelector(".tipo").textContent = posicao.tipo;
    return item;
}

// Um <li> dos destaques (a explicação da IA entra aqui no futuro)
function criarItemDestaque(posicao) {
    const item = document.createElement("li");
    item.innerHTML = `
        <article class="destaque">
            <h3></h3>
            <p class="tipo"></p>
            <p class="variacao"></p>
            <div class="explicacao">
                <p class="explicacao-titulo">Por que se mexeu</p>
                <p>Explicação da IA em breve.</p>
            </div>
        </article>
    `;
    item.querySelector("h3").textContent = posicao.ativo;
    item.querySelector(".tipo").textContent = posicao.tipo;
    const variacao = item.querySelector(".variacao");
    variacao.textContent = `${formatarPercentual(posicao.variacao)} hoje`;
    pintarSinal(variacao, posicao.variacao);
    return item;
}

// Escreve um valor com sinal e cor num cartão do resumo
function mostrarNoResumo(elemento, valor, base) {
    elemento.textContent = formatarResultado(valor, base);
    pintarSinal(elemento, valor);
}


async function carregarInicio() {
    let posicoes;
    try {
        posicoes = calcularPosicoes(await buscarOperacoes());
    } catch (erro) {
        console.error("Falha ao carregar a carteira:", erro);
        for (const campo of [campoPatrimonio, campoHoje, campoRendimento]) campo.textContent = "Indisponível";
        return;
    }

    // Carteira vazia: mostra os avisos e para por aqui
    if (posicoes.length === 0) {
        campoPatrimonio.textContent = formatarReais(0);
        campoHoje.textContent = "—";
        campoRendimento.textContent = "—";
        avisoCarteiraVazia.hidden = false;
        avisoDestaquesVazio.hidden = false;
        return;
    }

    // Desenha a lista com "Carregando…" e guarda cada <li> para preencher depois
    const itens = new Map();
    for (const posicao of posicoes) {
        const item = criarItemCarteira(posicao);
        itens.set(posicao.ativo, item);
        listaCarteira.appendChild(item);
    }

    const totalInvestido = posicoes.reduce((soma, p) => soma + p.custo, 0);
    let patrimonio = 0;     // valor atual de tudo
    let ganhoHoje = 0;      // quanto a carteira subiu ou caiu hoje, em R$
    let baseHoje = 0;       // quanto valia "ontem" (para calcular o % do dia)
    const comVariacao = []; // posições com variação do dia, para os destaques

    await cotarPosicoes(posicoes, (posicao, cotacao) => {
        const item = itens.get(posicao.ativo);
        const campoValor = item.querySelector(".campo-valor");

        if (!cotacao || typeof cotacao.preco !== "number") {
            // Sem cotação (ex.: Tesouro Direto): entra pelo valor investido
            campoValor.textContent = formatarReais(posicao.custo);
            patrimonio += posicao.custo;
            return;
        }

        const valorAtual = posicao.quantidade * cotacao.preco;
        campoValor.textContent = formatarReais(valorAtual);
        patrimonio += valorAtual;

        if (typeof cotacao.variacao === "number") {
            const campoVariacao = item.querySelector(".campo-variacao");
            campoVariacao.textContent = `${formatarPercentual(cotacao.variacao)} hoje`;
            pintarSinal(campoVariacao, cotacao.variacao);

            // Se hoje vale 110 e subiu 10%, ontem valia 110 / 1,10 = 100 → ganho de 10
            const valorOntem = valorAtual / (1 + cotacao.variacao / 100);
            ganhoHoje += valorAtual - valorOntem;
            baseHoje += valorOntem;
            comVariacao.push({ ...posicao, variacao: cotacao.variacao });
        }
    });

    // Resumo
    campoPatrimonio.textContent = formatarReais(patrimonio);
    mostrarNoResumo(campoHoje, ganhoHoje, baseHoje);
    mostrarNoResumo(campoRendimento, patrimonio - totalInvestido, totalInvestido);

    // Destaques: os 3 que mais se mexeram, para cima OU para baixo (Math.abs ignora o sinal)
    const destaques = comVariacao
        .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))
        .slice(0, 3);
    for (const posicao of destaques) listaDestaques.appendChild(criarItemDestaque(posicao));
    avisoDestaquesVazio.hidden = destaques.length > 0;
}

carregarInicio();
