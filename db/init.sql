-- Banco do chatbot: histórico das conversas e FAQ da empresa fictícia "Provedor Exemplo".

CREATE TABLE mensagens (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  -- false = mensagem do cliente que ainda não foi respondida.
  processed       BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mensagens_conversa_idx ON mensagens (conversation_id, id);

CREATE TABLE faq (
  id       SERIAL PRIMARY KEY,
  setor    TEXT NOT NULL CHECK (setor IN ('comercial', 'financeiro', 'suporte')),
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  busca    TSVECTOR GENERATED ALWAYS AS (to_tsvector('portuguese', pergunta || ' ' || resposta)) STORED
);

CREATE INDEX faq_busca_idx ON faq USING GIN (busca);

INSERT INTO faq (setor, pergunta, resposta) VALUES
  ('comercial', 'Quais planos de internet vocês têm?',
   'Temos três planos de fibra: 300 Mega por R$ 89,90, 600 Mega por R$ 109,90 e 1 Giga por R$ 149,90, todos com Wi-Fi incluso.'),
  ('comercial', 'Quanto tempo demora a instalação?',
   'A instalação é feita em até 3 dias úteis depois da contratação, sem custo de adesão.'),
  ('comercial', 'Vocês atendem no meu bairro?',
   'Atendemos toda a área urbana da cidade. Me passe o seu CEP que eu confirmo a cobertura na hora.'),
  ('comercial', 'Posso mudar de plano?',
   'Pode, sim. A troca de plano é gratuita e vale a partir do próximo ciclo de cobrança.'),
  ('financeiro', 'Como tiro a segunda via do boleto?',
   'A segunda via fica disponível na área do cliente. Se preferir, eu envio o boleto por aqui mesmo.'),
  ('financeiro', 'Quais são as formas de pagamento?',
   'Você pode pagar por boleto, Pix ou débito automático no cartão de crédito.'),
  ('financeiro', 'Posso mudar a data de vencimento?',
   'Pode. As datas disponíveis são os dias 5, 10, 15 e 20 de cada mês.'),
  ('financeiro', 'Paguei a fatura atrasada, quando a internet volta?',
   'Pagamentos por Pix liberam a internet em até 15 minutos. Por boleto, a liberação leva até 1 dia útil.'),
  ('suporte', 'Minha internet está lenta, o que faço?',
   'Desligue o roteador da tomada por 30 segundos e ligue de novo. Se continuar lenta, faça um teste em fast.com e me mande o resultado.'),
  ('suporte', 'Estou sem internet',
   'Confira se a luz LOS do aparelho está vermelha. Se estiver, é um problema na fibra e eu abro uma visita técnica para você.'),
  ('suporte', 'Como troco a senha do Wi-Fi?',
   'Acesse 192.168.0.1 no navegador, entre com o usuário admin e a senha que está na etiqueta do roteador, e troque em Wi-Fi > Segurança.'),
  ('suporte', 'Como peço uma visita técnica?',
   'Eu agendo a visita por aqui. O técnico vai em até 2 dias úteis, de segunda a sábado.');
