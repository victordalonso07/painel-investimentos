// =========================================================
// API: EXPLICAÇÃO DA IA (por que um ativo se mexeu hoje)
// Uso: /api/explicacao?ativo=PETR4&variacao=3.2
// Parte 1: buscar as notícias do dia
// =========================================================

function responderErro(mensagem, status) {
    return Response.json({ erro: mensagem }, { status: status });
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