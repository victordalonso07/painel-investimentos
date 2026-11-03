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

// Variação do dia de cada ativo seu (carteira e observação), usada nos destaques
const variacoesConhecidas = new Map();
function guardarVariacao(ativo, variacao, origem) {
    if (!variacoesConhecidas.has(ativo.ativo)) {   // se está nos dois, vale "Na sua carteira"
        variacoesConhecidas.set(ativo.ativo, { ativo: ativo.ativo, tipo: ativo.tipo, variacao, origem });
    }
}


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
                <p class="texto-explicacao resumida">Buscando o motivo…</p>
                <button type="button" class="botao-ler-mais" aria-expanded="false" hidden>Ler mais</button>
            </div>
        </article>
    `;
    item.querySelector("h3").textContent = posicao.ativo;
    // Ex.: "Ação · Na sua carteira" ou "Ação · Destaque da bolsa"
    item.querySelector(".tipo").textContent = `${posicao.tipo} · ${posicao.origem}`;
    const variacao = item.querySelector(".variacao");
    variacao.textContent = `${formatarPercentual(posicao.variacao)} hoje`;
    pintarSinal(variacao, posicao.variacao);

    // Pede a explicação para a NOSSA API (/api/explicacao), que busca as notícias e chama a IA.
    // Devolve o item E a "promessa" da explicação: quem chamou decide quando esperar por ela
    const explicacaoPronta = preencherExplicacao(item.querySelector(".texto-explicacao"), posicao);
    return { item, explicacaoPronta };
}

// "Ler mais": o texto começa cortado em 3 linhas (classe "resumida" no CSS).
// O botão só aparece se o texto for maior que isso; cada clique abre ou fecha
function ativarLerMais(item) {
    const texto = item.querySelector(".texto-explicacao");
    const botao = item.querySelector(".botao-ler-mais");

    // scrollHeight = altura do texto INTEIRO; clientHeight = altura que está aparecendo.
    // Se o inteiro é maior, parte do texto está escondida → precisa do botão
    if (texto.scrollHeight <= texto.clientHeight + 1) return;
    botao.hidden = false;

    botao.addEventListener("click", () => {
        // toggle: tira a classe se tem, põe se não tem. Devolve true se ela FICOU no elemento
        const resumido = texto.classList.toggle("resumida");
        botao.textContent = resumido ? "Ler mais" : "Ler menos";
        botao.setAttribute("aria-expanded", String(!resumido));   // avisa leitores de tela
    });
}

// Busca o "por que se mexeu" e escreve no destaque
async function preencherExplicacao(elemento, posicao) {
    const direcao = posicao.variacao >= 0 ? "alta" : "queda";
    const endereco = `/api/explicacao?ativo=${encodeURIComponent(posicao.ativo)}&direcao=${direcao}`;

    // Até 2 tentativas: se a IA estiver ocupada na primeira, espera 2 s e tenta de novo
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
        try {
            const dados = await buscarJSON(endereco);
            elemento.textContent = dados.explicacao;   // textContent: o texto da IA nunca vira código
            return;
        } catch (erro) {
            console.error(`Falha ao buscar a explicação de ${posicao.ativo} (tentativa ${tentativa}):`, erro);
            if (tentativa === 1) await new Promise((esperar) => setTimeout(esperar, 2000));
        }
    }
    elemento.textContent = "Explicação indisponível agora. Tente recarregar mais tarde.";
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
            guardarVariacao(posicao, cotacao.variacao, "Na sua carteira");
        }
    });

    // Resumo
    campoPatrimonio.textContent = formatarReais(patrimonio);
    mostrarNoResumo(campoHoje, ganhoHoje, baseHoje);
    mostrarNoResumo(campoRendimento, patrimonio - totalInvestido, totalInvestido);
}

// ---------------------------------------------------------
// Em observação: ativos da lista marcados "Mostrar no Início"
// ---------------------------------------------------------
async function carregarObservacaoInicio() {
    const secao = document.getElementById("secao-observacao");
    const lista = document.getElementById("inicio-observacao");
    let registros;
    try {
        registros = (await buscarObservacao()).filter((r) => r.mostrar_inicio);
    } catch (erro) {
        console.error("Falha ao carregar a observação:", erro);
        return;   // a seção continua escondida
    }
    if (registros.length === 0) return;

    const itens = new Map();
    for (const registro of registros) {
        // Mesmo formato da lista "Minha carteira", trocando "Valor atual" por "Preço"
        const item = criarItemCarteira({ ativo: registro.ativo, tipo: registro.tipo_ativo });
        item.querySelector("dt").textContent = "Preço";
        itens.set(registro.ativo, item);
        lista.appendChild(item);
    }
    secao.hidden = false;

    const ativos = registros.map((r) => ({ ativo: r.ativo, tipo: r.tipo_ativo }));
    await cotarPosicoes(ativos, (ativo, cotacao) => {
        const item = itens.get(ativo.ativo);
        const campoValor = item.querySelector(".campo-valor");
        if (!cotacao || typeof cotacao.preco !== "number") {
            campoValor.textContent = "Sem cotação";
            return;
        }
        campoValor.textContent = formatarReais(cotacao.preco);
        if (typeof cotacao.variacao === "number") {
            const campoVariacao = item.querySelector(".campo-variacao");
            campoVariacao.textContent = `${formatarPercentual(cotacao.variacao)} hoje`;
            pintarSinal(campoVariacao, cotacao.variacao);
            guardarVariacao(ativo, cotacao.variacao, "Em observação");
        }
    });
}

// ---------------------------------------------------------
// Destaques do dia: os 3 ativos que mais se mexeram (para cima OU para baixo)
// 1º os SEUS (carteira e observação); se faltar, completa com as principais ações da bolsa
// ---------------------------------------------------------
async function carregarDestaques() {
    // Os seus que já têm variação (guardados pela carteira e pela observação)
    const pessoais = [...variacoesConhecidas.values()];

    // Principais ações da bolsa (lista do js/comum.js), tirando as que já são suas
    const mercado = [];
    if (pessoais.length < 3) {
        const candidatos = ATIVOS_SUGERIDOS["Ação"]
            .filter((ativo) => !variacoesConhecidas.has(ativo))
            .map((ativo) => ({ ativo: ativo, tipo: "Ação" }));
        await cotarPosicoes(candidatos, (ativo, cotacao) => {
            if (typeof cotacao?.variacao === "number") {
                mercado.push({ ...ativo, variacao: cotacao.variacao, origem: "Destaque da bolsa" });
            }
        });
    }

    // Math.abs ignora o sinal: -4% "mexeu mais" que +2%
    const porMovimento = (a, b) => Math.abs(b.variacao) - Math.abs(a.variacao);
    const destaques = [...pessoais.sort(porMovimento), ...mercado.sort(porMovimento)].slice(0, 3);

    if (destaques.length === 0) {
        avisoDestaquesVazio.textContent = "Não foi possível buscar os destaques agora. Tente recarregar mais tarde.";
        return;
    }

    // Cria os 3 cartões "fora da tela" e espera TODAS as explicações da IA ficarem prontas.
    // Promise.all = "espere todas essas promessas terminarem" (rodam ao mesmo tempo, não uma por vez)
    const cartoes = destaques.map(criarItemDestaque);
    await Promise.all(cartoes.map((cartao) => cartao.explicacaoPronta));

    // Tudo pronto: tira a mensagem "Analisando…" e mostra os 3 de uma vez
    for (const cartao of cartoes) listaDestaques.appendChild(cartao.item);
    avisoDestaquesVazio.hidden = true;

    // Só agora os cartões estão na tela e dá para medir o tamanho dos textos
    for (const cartao of cartoes) ativarLerMais(cartao.item);
}

// Ordem: carteira → observação → destaques (os destaques usam as variações das duas primeiras)
carregarInicio()
    .then(carregarObservacaoInicio)
    .then(carregarDestaques);
