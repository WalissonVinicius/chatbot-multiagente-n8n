// Serviços falsos para o teste de ponta a ponta:
// - um LLM compatível com a API da OpenAI, que responde de forma previsível;
// - um "WhatsApp" que só guarda as respostas e transferências que o chatbot enviaria.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4000);
const TRANSCRICAO = "minha internet está muito lenta";

// Ordem importa: o primeiro padrão que bater decide o setor.
const SETORES = [
  ["humano", /atendente|humano|pessoa|reclama/i],
  ["financeiro", /boleto|fatura|pagamento|pix|vencimento/i],
  ["comercial", /plano|contratar|pre[çc]o|instala/i],
  ["suporte", /lenta|caiu|sem internet|wi-?fi|senha|t[ée]cnic/i],
];

let sent = { replies: [], handoffs: [] };

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const sendJson = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

const completion = (content) => ({
  id: "chatcmpl-fake",
  object: "chat.completion",
  choices: [
    { index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } },
  ],
});

const chatCompletion = (body) => {
  const messages = body.messages ?? [];
  const system = messages[0]?.content ?? "";
  const lastUser = messages.findLast((message) => message.role === "user")?.content ?? "";

  if (lastUser.includes("[falha]")) return null;

  if (system.includes("[TRIAGEM]")) {
    const setor = SETORES.find(([, pattern]) => pattern.test(lastUser))?.[0] ?? "suporte";
    return completion({ setor, resumo: `Cliente disse: ${lastUser}` });
  }

  // O "agente" devolve a primeira resposta do FAQ que veio no prompt.
  const resposta = system.match(/^R: (.+)$/m)?.[1] ?? "Pode me dar mais detalhes?";
  return completion({ resposta, transferir: false });
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const route = `${req.method} ${pathname}`;
  const raw = await readBody(req);

  switch (route) {
    case "GET /health":
      return sendJson(res, 200, { ok: true });

    case "POST /v1/chat/completions": {
      const result = chatCompletion(JSON.parse(raw.toString() || "{}"));
      return result
        ? sendJson(res, 200, result)
        : sendJson(res, 500, { error: { message: "falha simulada" } });
    }

    case "POST /v1/audio/transcriptions":
      return sendJson(res, 200, { text: TRANSCRICAO });

    case "GET /audio/exemplo.ogg":
      res.writeHead(200, { "Content-Type": "audio/ogg" });
      return res.end(Buffer.from("OggS-audio-falso"));

    case "POST /reply":
      sent.replies.push(JSON.parse(raw.toString()));
      return sendJson(res, 200, { ok: true });

    case "POST /handoff":
      sent.handoffs.push(JSON.parse(raw.toString()));
      return sendJson(res, 200, { ok: true });

    case "GET /sent":
      return sendJson(res, 200, sent);

    case "DELETE /sent":
      sent = { replies: [], handoffs: [] };
      return sendJson(res, 200, { ok: true });

    default:
      return sendJson(res, 404, { error: `rota não encontrada: ${route}` });
  }
});

server.listen(PORT, () => console.log(`serviços falsos em http://localhost:${PORT}`));
