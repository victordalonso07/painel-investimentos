// =========================================================
// GRÁFICO DE HISTÓRICO: janela que abre por cima da página
// Uso: abrirGrafico({ ativo: "PETR4", tipo: "Ação" })
// - B3 (ação, FII, ETF, BDR): pela NOSSA API /api/historico
// - Cripto: CoinGecko (grátis, sem chave)
// Desenho: biblioteca Chart.js (carregada no <head> da página)
// =========================================================

const PERIODOS_GRAFICO = [
    { id: "5d", nome: "5 dias", dias: 5 },
    { id: "1mo", nome: "1 mês", dias: 30 },
    { id: "3mo", nome: "3 meses", dias: 90 },
];

let janelaGrafico = null;    // o <dialog>, criado uma vez só
let graficoAtual = null;     // o desenho do Chart.js (precisa ser destruído antes de desenhar outro)
let ativoDoGrafico = null;   // { ativo, tipo } que está aberto agora
let desenhoAtual = 0;        // conta os pedidos: só o mais recente pode desenhar


// Cria a janela (<dialog>) na primeira vez que for usada
function criarJanelaGrafico() {
    const janela = document.createElement("dialog");
    janela.className = "janela-grafico";
    janela.setAttribute("aria-labelledby", "titulo-grafico");
    janela.innerHTML = `
        <div class="grafico-topo">
            <div>
                <h2 id="titulo-grafico"></h2>
                <p class="grafico-variacao"></p>
            </div>
            <button type="button" class="botao-fechar" aria-label="Fechar gráfico">✕</button>
        </div>
        <div class="grafico-periodos" role="group" aria-label="Período do gráfico"></div>
        <div class="grafico-area">
            <canvas aria-label="Gráfico do preço no período" role="img"></canvas>
            <p class="grafico-status" role="status"></p>
        </div>
    `;

    // Um botão por período (5 dias, 1 mês, 3 meses)
    const grupo = janela.querySelector(".grafico-periodos");
    for (const periodo of PERIODOS_GRAFICO) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "botao-periodo";
        botao.textContent = periodo.nome;
        botao.dataset.periodo = periodo.id;
        botao.addEventListener("click", () => desenharGrafico(periodo));
        grupo.appendChild(botao);
    }

    janela.querySelector(".botao-fechar").addEventListener("click", () => janela.close());
    // Clicar fora da caixa (no fundo escuro) também fecha
    janela.addEventListener("click", (evento) => {
        if (evento.target === janela) janela.close();
    });

    document.body.appendChild(janela);
    return janela;
}


// Abre a janela para um ativo (começa no período de 1 mês)
function abrirGrafico(ativo) {
    janelaGrafico ??= criarJanelaGrafico();   // "??=": só cria se ainda não existir
    ativoDoGrafico = ativo;
    janelaGrafico.querySelector("#titulo-grafico").textContent = `${ativo.ativo} · ${ativo.tipo}`;
    janelaGrafico.showModal();   // abre por cima da página; a tecla Esc fecha
    desenharGrafico(PERIODOS_GRAFICO[1]);
}


// Busca os pontos (data, preço) do período
async function buscarHistorico(ativo, periodo) {
    if (ativo.tipo === "Cripto") {
        const id = IDS_COINGECKO[ativo.ativo];
        if (!id) throw new Error("Cripto sem identificador na CoinGecko");
        const dados = await buscarJSON(
            `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=brl&days=${periodo.dias}`
        );
        // A CoinGecko manda [[data, preço], ...]
        return dados.prices.map(([data, preco]) => ({ data, preco }));
    }
    if (TIPOS_B3.includes(ativo.tipo)) {
        const dados = await buscarJSON(
            `/api/historico?ativo=${encodeURIComponent(ativo.ativo)}&periodo=${periodo.id}`
        );
        return dados.pontos;
    }
    throw new Error("Tipo sem histórico disponível");
}


// Desenha (ou redesenha) o gráfico para o período escolhido
async function desenharGrafico(periodo) {
    const meuDesenho = ++desenhoAtual;
    const janela = janelaGrafico;
    const ativo = ativoDoGrafico;
    const status = janela.querySelector(".grafico-status");
    const variacao = janela.querySelector(".grafico-variacao");

    // Marca o botão do período escolhido
    for (const botao of janela.querySelectorAll(".botao-periodo")) {
        botao.setAttribute("aria-pressed", String(botao.dataset.periodo === periodo.id));
    }

    mostrarCarregando(status, "Carregando histórico");
    variacao.textContent = "";
    graficoAtual?.destroy();   // apaga o desenho anterior
    graficoAtual = null;

    let pontos;
    try {
        pontos = await buscarHistorico(ativo, periodo);
    } catch (erro) {
        if (meuDesenho !== desenhoAtual) return;
        console.error(`Falha ao buscar o histórico de ${ativo.ativo}:`, erro);
        status.textContent = ativo.tipo === "Tesouro Direto" || ativo.tipo === "Outro"
            ? "Ainda não há histórico para este tipo de ativo."
            : "Histórico indisponível agora. Tente mais tarde.";
        return;
    }
    // Se trocaram de ativo ou período enquanto carregava, não desenha um gráfico velho
    if (meuDesenho !== desenhoAtual) return;
    if (!pontos || pontos.length < 2) {
        status.textContent = "Poucos dados para desenhar o gráfico.";
        return;
    }
    status.textContent = "";

    // Variação no período: do primeiro ao último preço
    const primeiro = pontos[0].preco;
    const ultimo = pontos[pontos.length - 1].preco;
    const percentual = ((ultimo - primeiro) / primeiro) * 100;
    variacao.textContent = `${formatarReais(ultimo)} · ${formatarPercentual(percentual)} em ${periodo.nome}`;
    pintarSinal(variacao, percentual);

    // Cores vêm das variáveis do CSS: o gráfico acompanha o modo claro/escuro
    const estilo = getComputedStyle(document.documentElement);
    const corLinha = estilo.getPropertyValue("--laranja").trim();
    const corTexto = estilo.getPropertyValue("--tinta-suave").trim();
    const corGrade = estilo.getPropertyValue("--linha").trim();

    // Chart.js: tipo "line" (linha). labels = eixo de baixo (datas); data = alturas (preços)
    graficoAtual = new Chart(janela.querySelector("canvas"), {
        type: "line",
        data: {
            labels: pontos.map((p) =>
                new Date(p.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            ),
            datasets: [{
                data: pontos.map((p) => p.preco),
                borderColor: corLinha,
                backgroundColor: corLinha,
                borderWidth: 2,
                pointRadius: 0,          // sem bolinhas em cada dia: linha limpa
                pointHoverRadius: 4,     // a bolinha aparece só ao passar o mouse/dedo
                tension: 0.25,           // linha levemente curvada
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },   // mostra o valor só de chegar perto
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (contexto) => formatarReais(contexto.parsed.y) } },
            },
            scales: {
                x: { ticks: { color: corTexto, maxTicksLimit: 6 }, grid: { display: false } },
                y: {
                    // Eixo mais curto: sem centavos quando o valor passa de R$ 1.000
                    ticks: {
                        color: corTexto,
                        callback: (valor) => valor >= 1000
                            ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                            : formatarReais(valor),
                    },
                    grid: { color: corGrade },
                },
            },
        },
    });
}


// Cria o botão "Gráfico" para colocar num cartão (Carteira e Observação usam)
function criarBotaoGrafico(ativo) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao-grafico";
    botao.textContent = "Ver gráfico";
    botao.setAttribute("aria-label", `Ver gráfico de ${ativo.ativo}`);
    botao.addEventListener("click", () => abrirGrafico(ativo));
    return botao;
}
