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

// Variação do dia dos SEUS ativos, separada por origem (usada em "Por que seus ativos se mexeram")
const variacoesCarteira = [];
const variacoesObservacao = [];
function guardarVariacao(ativo, variacao, origem) {
    const lista = origem === "Na sua carteira" ? variacoesCarteira : variacoesObservacao;
    lista.push({ ativo: ativo.ativo, tipo: ativo.tipo, variacao });
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
                <dd class="campo-valor">Carregando${PONTINHOS}</dd>
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
                <p class="texto-explicacao resumida">Buscando o motivo${PONTINHOS}</p>
                <button type="button" class="botao-ler-mais" aria-expanded="false" hidden>Ler mais</button>
            </div>
        </article>
    `;
    item.querySelector("h3").textContent = posicao.ativo;
    item.querySelector(".tipo").textContent = posicao.tipo;
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
        registros = await buscarObservacao();
    } catch (erro) {
        console.error("Falha ao carregar a observação:", erro);
        return;   // a seção continua escondida
    }
    if (registros.length === 0) return;

    // Na lista "Em observação" só entram os marcados "Mostrar no Início";
    // mas TODOS são cotados, para a explicação da IA na lateral
    const itens = new Map();
    for (const registro of registros.filter((r) => r.mostrar_inicio)) {
        // Mesmo formato da lista "Minha carteira", trocando "Valor atual" por "Preço"
        const item = criarItemCarteira({ ativo: registro.ativo, tipo: registro.tipo_ativo });
        item.querySelector("dt").textContent = "Preço";
        itens.set(registro.ativo, item);
        lista.appendChild(item);
    }
    secao.hidden = itens.size === 0;

    const ativos = registros.map((r) => ({ ativo: r.ativo, tipo: r.tipo_ativo }));
    await cotarPosicoes(ativos, (ativo, cotacao) => {
        if (typeof cotacao?.variacao === "number") guardarVariacao(ativo, cotacao.variacao, "Em observação");
        const item = itens.get(ativo.ativo);
        if (!item) return;   // não está marcado para o Início: só guardamos a variação
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
        }
    });
}

// ---------------------------------------------------------
// Destaques do dia: os 3 ativos que mais se mexeram (para cima OU para baixo)
// 1º os SEUS (carteira e observação); se faltar, completa com as principais ações da bolsa
// ---------------------------------------------------------
async function carregarDestaques() {
    // Só as principais ações da bolsa (lista do js/comum.js): o "termômetro" do dia
    const candidatos = ATIVOS_SUGERIDOS["Ação"].map((ativo) => ({ ativo: ativo, tipo: "Ação" }));
    const mercado = [];
    await cotarPosicoes(candidatos, (ativo, cotacao) => {
        if (typeof cotacao?.variacao === "number") {
            mercado.push({ ...ativo, variacao: cotacao.variacao, origem: "Destaque da bolsa" });
        }
    });

    // As 3 que mais chamaram a atenção: maior movimento, para cima OU para baixo
    const destaques = mercado.sort(porMovimento).slice(0, 3);

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

// Math.abs ignora o sinal: -4% "mexeu mais" que +2%
function porMovimento(a, b) {
    return Math.abs(b.variacao) - Math.abs(a.variacao);
}


// ---------------------------------------------------------
// Lateral: "Por que seus ativos se mexeram"
// Até 3 da carteira e até 3 da observação (os que mais se mexeram), em blocos separados
// ---------------------------------------------------------
const MAXIMO_EXPLICACOES = 3;   // limite por bloco, para poupar o limite grátis da IA

// Monta um bloco (carteira OU observação) e devolve as "promessas" das explicações.
// Não espera aqui: quem chama espera as dos DOIS blocos juntas
function montarBlocoExplicacoes(variacoes, idLista, idAviso, textoVazio) {
    const lista = document.getElementById(idLista);
    const aviso = document.getElementById(idAviso);
    const escolhidos = [...variacoes].sort(porMovimento).slice(0, MAXIMO_EXPLICACOES);

    if (escolhidos.length === 0) {
        aviso.textContent = textoVazio;
        aviso.hidden = false;
        return [];
    }

    return escolhidos.map((ativo) => {
        const item = document.createElement("li");
        item.innerHTML = `
            <p class="explicacao-cabecalho"><span class="nome"></span><span class="variacao"></span></p>
            <p class="texto-explicacao resumida"></p>
            <button type="button" class="botao-ler-mais" aria-expanded="false" hidden>Ler mais</button>
        `;
        item.querySelector(".nome").textContent = ativo.ativo;
        const variacao = item.querySelector(".variacao");
        variacao.textContent = formatarPercentual(ativo.variacao);
        pintarSinal(variacao, ativo.variacao);
        lista.appendChild(item);   // está dentro do bloco escondido: ainda não aparece na tela

        // Quando a explicação chegar, devolve o item (para ativar o "Ler mais" depois)
        return preencherExplicacao(item.querySelector(".texto-explicacao"), ativo).then(() => item);
    });
}

async function carregarExplicacoesPessoais() {
    const promessas = [
        ...montarBlocoExplicacoes(variacoesCarteira, "explicacoes-carteira", "explicacoes-carteira-vazia",
            "Nenhum ativo da carteira com cotação hoje. Cadastre compras na Carteira."),
        ...montarBlocoExplicacoes(variacoesObservacao, "explicacoes-observacao", "explicacoes-observacao-vazia",
            "Nenhum ativo na observação com cotação hoje. Adicione ativos na página Observação."),
    ];

    // Mesmo padrão dos destaques: espera TODAS as explicações (dos dois blocos) ficarem prontas
    const itens = await Promise.all(promessas);

    // Tudo pronto: tira o "Analisando seus ativos..." e mostra o conteúdo de uma vez
    document.getElementById("seus-ativos-carregando").hidden = true;
    document.getElementById("seus-ativos-conteudo").hidden = false;

    // Só agora os textos estão visíveis e dá para medir se precisam do "Ler mais"
    for (const item of itens) ativarLerMais(item);
}

// Ordem: carteira → observação (guardam as variações) → destaques da bolsa e a lateral, ao mesmo tempo
carregarInicio()
    .then(carregarObservacaoInicio)
    .then(() => Promise.all([carregarDestaques(), carregarExplicacoesPessoais()]));
