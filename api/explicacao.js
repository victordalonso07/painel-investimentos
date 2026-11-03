// =========================================================
// API: EXPLICAÇÃO DA IA (por que um ativo se mexeu hoje)
// Uso: /api/explicacao?ativo=PETR4&direcao=alta
// 1. busca as notícias do dia  2. manda para o Gemini  3. devolve a explicação (cache de 6 h)
// =========================================================

function responderErro(mensagem, status) {
    return Response.json({ erro: mensagem }, { status: status });
}

// Modelo do Gemini (plano grátis). Se o Google trocar o nome, é só mudar aqui
const MODELO = "gemini-3.6-flash";
// Modelo reserva: mais leve e com limite grátis maior. Usado se o principal estiver no limite ou fora do ar
const MODELO_RESERVA = "gemini-3.5-flash-lite";

// Erro com o código HTTP junto, para a resposta da API dizer o motivo certo (ex.: 429 = limite)
class ErroIA extends Error {
    constructor(mensagem, status) {
        super(mensagem);
        this.status = status;
    }
}

// Regras que a IA segue SEMPRE (o "prompt de sistema")
const REGRAS = `
Você explica o mercado financeiro para um investidor iniciante, em português do Brasil.
Explique em no máximo 3 frases curtas por que o ativo se mexeu hoje.
Use linguagem simples: se usar um termo técnico (ex.: Opep, Selic, dividendo), explique em poucas palavras.
Os FATOS precisam vir das notícias recebidas; você pode usar seu conhecimento só para explicar conceitos e ligar causa e efeito.
Nunca invente fatos, números ou acontecimentos que não estejam nas notícias.
Se as notícias não explicarem o movimento, diga isso com honestidade (ex.: "Não há notícia específica hoje; o ativo acompanhou o mercado em geral").
Não faça previsões e não recomende comprar, vender ou manter.
Termine com a fonte principal entre parênteses, ex.: (Fonte: InfoMoney).
`;

// Monta a pergunta do dia: ativo, variação e a lista de manchetes
function montarPergunta(ativo, direcao, noticias) {
    const lista = noticias.length > 0
        ? noticias.map((n) => `- ${n.titulo} [${n.fonte}]`).join("\n")
        : "(nenhuma notícia encontrada)";
    return `Ativo: ${ativo}\nMovimento hoje: ${direcao}\n\nNotícias de hoje:\n${lista}`;
}

// O RSS troca alguns símbolos por códigos (ex.: "&amp;" no lugar de "&"). Aqui desfazemos isso
function limparTexto(texto) {
    return texto
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
}

// Busca as manchetes das últimas 24 h sobre o ativo no Google Notícias
async function buscarNoticias(ativo) {
     // Tesouro: notícia sobre "TESOURO SELIC 2029" quase não existe; buscamos o tipo do título
     // (sem o ano) e as taxas do Tesouro Direto em geral, que é o que move esses preços
     const termo = ativo.startsWith("TESOURO")
         ? `"${ativo.replace(/\s*\d{4}$/, "")}" OR "Tesouro Direto" taxas`
         : ativo;
     // "when:1d" = só notícias do último dia
     const busca = encodeURIComponent(`${termo} when:1d`);
     const endereco = `https://news.google.com/rss/search?q=${busca}&hl=pt-BR&gl=BR&ceid=BR:pt-419`

     const resposta = await fetch(endereco);
     if (!resposta.ok) {
        throw new Error(`Google Notícias respondeu ${resposta.status}`);
     }
     const xml = await resposta.text(); // RSS vem como texto (XML), não JSON

      // Cada notícia fica entre <item> e </item>: pegamos as 8 primeiras
      const itens = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      const noticias = [];
      for (const item of itens.slice(0,8)) {
        const titulo = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
        const fonte = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1];
        if (titulo) {
            noticias.push({titulo: limparTexto(titulo), fonte: fonte ? limparTexto(fonte) : ""});
        }
      }
      return noticias;
}


// Manda as regras + a pergunta para o Gemini e devolve o texto da resposta
// Manda as regras + a pergunta para o Gemini e devolve o texto da resposta.
// Tenta o modelo principal; se ele estiver no limite (429), sobrecarregado (503) ou não existir (404), tenta o reserva
async function perguntarIA(pergunta) {
    const chave = process.env.GEMINI_API_KEY;   // pega a chave no cofre da Vercel
    if (!chave) {
        throw new ErroIA("A variável GEMINI_API_KEY não está configurada na Vercel.", 500);
    }

    let ultimoErro;
    for (const modelo of [MODELO, MODELO_RESERVA]) {
        const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": chave,   // a chave vai no cabeçalho, nunca no endereço
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: REGRAS }] },   // as regras fixas
                contents: [{ parts: [{ text: pergunta }] }],         // a pergunta do dia
                generationConfig: { temperature: 0.3 },              // 0.3 = mais objetiva, menos "criativa"
            }),
        });

        if (resposta.ok) {
            const dados = await resposta.json();
            // A resposta vem "embrulhada": candidates → content → parts → text
            const texto = dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
            if (texto) return texto;
            ultimoErro = new ErroIA("Gemini não devolveu texto.", 502);
            continue;
        }

        // O detalhe do erro fica só no registro do servidor (aba Logs da Vercel)
        console.error(`Gemini (${modelo}) respondeu com erro:`, resposta.status, await resposta.text());
        ultimoErro = new ErroIA(`Gemini respondeu ${resposta.status}`, resposta.status);
        // Só vale tentar o reserva nesses casos; chave errada (400/403), por exemplo, falharia igual
        if (![429, 503, 404].includes(resposta.status)) break;
    }
    throw ultimoErro;
}


export default {
    async fetch(request) {
        const url = new URL(request.url);
        const ativo = url.searchParams.get("ativo");
        const direcao = url.searchParams.get("direcao");   // "alta" ou "queda"

        // Valida o ativo: letras, números, espaço e "+" (para títulos como "TESOURO IPCA+ 2035"), até 40
        if (!ativo || !/^[A-Za-z0-9+ ]{2,40}$/.test(ativo.trim())) {
            return responderErro("Informe um ativo válido. Exemplo: ?ativo=PETR4&direcao=alta", 400);
        }
        if (direcao !== "alta" && direcao !== "queda") {
            return responderErro("Informe a direção: alta ou queda.", 400);
        }

        try {
            const ativoMaiusculo = ativo.trim().replace(/\s+/g, " ").toUpperCase();
            const noticias = await buscarNoticias(ativoMaiusculo);                       // parte 1
            const pergunta = montarPergunta(ativoMaiusculo, direcao, noticias);          // parte 2a
            const explicacao = await perguntarIA(pergunta);                              // parte 2b

            return Response.json(
                { ativo: ativoMaiusculo, explicacao: explicacao },
                {
                    headers: {
                        // Guarda a explicação por 6 horas (21600 s): o mesmo texto serve o dia todo
                        // e o limite grátis do Gemini não é gasto a cada F5
                        "Cache-Control": "public, s-maxage=21600",
                    },
                }
            );
        } catch (erro) {
            console.error("Falha ao gerar a explicação:", erro);
            // 429: os dois modelos estão no limite grátis. Avisa o site para mostrar a mensagem certa
            if (erro.status === 429) {
                return responderErro("A IA atingiu o limite gratuito por agora.", 429);
            }
            return responderErro("Explicação indisponível no momento.", 502);
        }
    },
};
