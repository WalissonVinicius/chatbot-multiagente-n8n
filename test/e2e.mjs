// Teste de ponta a ponta: manda mensagens para o webhook do n8n e confere o que o chatbot
// respondeu e transferiu. Precisa do compose de teste rodando (veja o README).
import assert from "node:assert/strict";

const N8N_URL = process.env.N8N_URL ?? "http://localhost:5678";
const FAKE_URL = process.env.FAKE_URL ?? "http://localhost:4000";
// Endereço dos serviços falsos visto de dentro do container do n8n.
const FAKE_INTERNAL_URL = process.env.FAKE_INTERNAL_URL ?? "http://fake-services:4000";
const TIMEOUT_MS = 60_000;
// Depois da resposta, espera mais um pouco para ter certeza de que não veio outra.
const QUIET_MS = 4_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const post = async (body) => {
  const res = await fetch(`${N8N_URL}/webhook/chatbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const sent = async () => (await fetch(`${FAKE_URL}/sent`)).json();
const repliesFor = (data, conversationId) =>
  data.replies.filter((reply) => reply.conversationId === conversationId);
const handoffsFor = (data, conversationId) =>
  data.handoffs.filter((handoff) => handoff.conversationId === conversationId);

const waitForReply = async (conversationId) => {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const replies = repliesFor(await sent(), conversationId);
    if (replies.length > 0) {
      await sleep(QUIET_MS);
      return sent();
    }
    await sleep(500);
  }
  throw new Error(`nenhuma resposta para ${conversationId} em ${TIMEOUT_MS / 1000}s`);
};

const tests = {
  async "entrada inválida recebe 400"() {
    const res = await post({ type: "text" });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.includes("conversationId inválido"));
  },

  async "triagem financeira responde com o FAQ do setor"() {
    const id = "teste-financeiro";
    assert.equal((await post({ conversationId: id, text: "Quero a segunda via do boleto" })).status, 202);
    const [reply] = repliesFor(await waitForReply(id), id);
    assert.match(reply.text, /segunda via/i);
  },

  async "entrega repetida do mesmo messageId é ignorada"() {
    const id = "teste-duplicada";
    const message = { conversationId: id, text: "Quais as formas de pagamento?", messageId: "wamid-123" };
    assert.equal((await post(message)).status, 202);
    const repeated = await post(message);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.status, "duplicada");
    assert.equal(repliesFor(await waitForReply(id), id).length, 1);
  },

  async "debounce junta mensagens seguidas em uma resposta só"() {
    const id = "teste-debounce";
    await post({ conversationId: id, text: "Oi, tudo bem?" });
    await sleep(500);
    await post({ conversationId: id, text: "Quais planos vocês têm?" });
    const replies = repliesFor(await waitForReply(id), id);
    assert.equal(replies.length, 1);
    assert.match(replies[0].text, /300 Mega/);
  },

  async "áudio é transcrito e cai no suporte"() {
    const id = "teste-audio";
    await post({ conversationId: id, type: "audio", audioUrl: `${FAKE_INTERNAL_URL}/audio/exemplo.ogg` });
    const [reply] = repliesFor(await waitForReply(id), id);
    assert.match(reply.text, /roteador/i);
  },

  async "pedido de pessoa vai para a equipe com resumo"() {
    const id = "teste-humano";
    await post({ conversationId: id, text: "Quero falar com um atendente" });
    const data = await waitForReply(id);
    const [handoff] = handoffsFor(data, id);
    assert.equal(handoff.setor, "humano");
    assert.match(handoff.resumo, /atendente/);
    assert.match(repliesFor(data, id)[0].text, /equipe/);
  },

  async "falha da IA transfere para a equipe"() {
    const id = "teste-falha";
    await post({ conversationId: id, text: "[falha] não consigo pagar" });
    const data = await waitForReply(id);
    const [handoff] = handoffsFor(data, id);
    assert.match(handoff.resumo, /A IA não respondeu/);
    assert.match(repliesFor(data, id)[0].text, /equipe/);
  },
};

await fetch(`${FAKE_URL}/sent`, { method: "DELETE" });

const names = Object.keys(tests);
const results = await Promise.allSettled(names.map((name) => tests[name]()));

let failed = 0;
results.forEach((result, index) => {
  if (result.status === "fulfilled") {
    console.log(`ok      ${names[index]}`);
  } else {
    failed += 1;
    console.log(`FALHOU  ${names[index]}\n        ${result.reason?.message}`);
  }
});

if (failed > 0) {
  console.log("\nO que o chatbot enviou:\n", JSON.stringify(await sent(), null, 2));
  process.exit(1);
}
console.log(`\n${names.length} testes passaram`);
