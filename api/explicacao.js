// =========================================================
// API: EXPLICAÇÃO DA IA (por que um ativo se mexeu hoje)
// Uso: /api/explicacao?ativo=PETR4&variacao=3.2
// Parte 1: buscar as notícias do dia
// =========================================================

function responderErro(mensagem, status) {
    return Response.json({ erro: mensagem }, { status: status });
}

// Modelo do Gemini (plano grátis). Se o Google trocar o nome, é só mudar aqui
const MODELO = "gemini-3.6-flash";

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
function montarPergunta(ativo, variacao, noticias) {
    const lista = noticias.length > 0
        ? noticias.map((n) => `- ${n.titulo} [${n.fonte}]`).join("\n")
        : "(nenhuma notícia encontrada)";
    return `Ativo: ${ativo}\nVariação hoje: ${variacao}%\n\nNotícias de hoje:\n${lista}`;
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
     // "when:1d" = só notícias do último dia
     const busca = encodeURIComponent(`${ativo} when:1d`);
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
async function perguntarIA(pergunta) {
    const chave = process.env.GEMINI_API_KEY;   // pega a chave no cofre da Vercel
    if (!chave) {
        throw new Error("A variável GEMINI_API_KEY não está configurada na Vercel.");
    }

    const endereco = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

    const resposta = await fetch(endereco, {
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

    if (!resposta.ok) {
        // O detalhe do erro fica só no registro do servidor (pode conter dados internos)
        console.error("Gemini respondeu com erro:", resposta.status, await resposta.text());
        throw new Error(`Gemini respondeu ${resposta.status}`);
    }

    const dados = await resposta.json();
    // A resposta vem "embrulhada": candidates → content → parts → text
    const texto = dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!texto) {
        throw new Error("Gemini não devolveu texto.");
    }
    return texto;
}


export default {
    async fetch(request) {
        const url = new URL(request.url);
        const ativo = url.searchParams.get("ativo");

        // Mesma validação da /api/cotacao: 2 a 10 letras/números
        if (!ativo || !/^[A-Za-z0-9]{2,10}$/.test(ativo)) {
            return responderErro("Informe um ativo válido. Exemplo: ?ativo=PETR4", 400);
    }

    try {
        const noticias = await buscarNoticias(ativo.toUpperCase());
        // Por enquanto só devolve as notícias, para testarmos esta parte
        return Response.json({ativo: ativo.toUpperCase(), noticias: noticias });
        } catch (erro) {
            console.error("Falha ao buscar notícias:", erro);
            return responderErro("Não foi possível buscar notícias.", 502);
        }
    },
};