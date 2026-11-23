# UFES Redes Trab2 — Frontend

Tela web do Projeto 1 (Redes de Computadores, UFES). É HTML, CSS e JavaScript nativo, sem dependências. A tela manda
o pedido ao gateway por `fetch` POST e lê a resposta em **SSE**, mostrando:

- a **posição na fila** ao vivo;
- o texto chegando em trechos durante a geração;
- as **métricas do pedido** (TTFT, latência, tokens/s);
- o prontuário validado em **cartões**.

Diagramas e código explicados: [EXPLICACAO.md](EXPLICACAO.md).

## Rodar

**Jeito normal: pelo gateway (mesma origem, sem CORS).** O gateway do Backend serve esta tela em `/`. Com os três
repositórios lado a lado:

```bash
cd ../UFES_Redes_Trab2_Backend
python3 lab.py demo        # sobe os nós LLM e o gateway; imprime a URL e o token
```

Abra `https://127.0.0.1:8443`, aceite o certificado da CA local e cole o token impresso no terminal. A URL do Backend
na tela já vem preenchida com a própria origem. Várias máquinas: `docs/LABORATORIO.md` do Backend.

**Alternativa: servidor estático separado** (para mexer só na tela). Em outro terminal, com o gateway no ar:

```bash
npm run build
python3 -m http.server 5173 --directory dist
```

Abra `http://127.0.0.1:5173` (não abra `index.html` como arquivo) e informe a URL do gateway em **URL do Backend**.
Como a página e a API ficam em origens diferentes, a origem da página precisa estar em `gateway.cors_origins` no
Backend; o perfil `configs/cpu_minimal.toml` já permite `http://127.0.0.1:5173`. Para um gateway remoto, a tela
exige HTTPS e a confirmação de confiança na origem antes de enviar o token.

## Testes

```bash
npm test          # Node 20+; 15 testes do parser SSE e da máquina de estados
npm run build     # copia index.html e src/ para dist/
```

O CI do GitHub Actions roda os dois a cada push.

## Contrato

A tela segue o contrato público **v1.1** do Backend. A cópia está em `contracts/public/v1/`, e o Backend confere se é
idêntica com `scripts/check-public-contract.sh`. Eventos: `meta`, `queued`, `delta`, `result`, `done` e `error`.

## Segurança

- Token e resultados ficam só em memória; "Limpar sessão" apaga tudo.
- Toda saída do modelo entra como texto (`textContent`), nunca como HTML.
- A CSP permite scripts só da própria origem.
- HTTP só é aceito para `localhost`; URL remota precisa de HTTPS e de confirmação explícita antes de mandar o token.
- **Use apenas textos sintéticos**: nunca dados reais de saúde.

Histórico: [CHANGELOG.md](CHANGELOG.md).

## Teste no laboratório e apresentação

O roteiro de teste com vários PCs e o material para a apresentação (decisões técnicas, trade-offs e perguntas prováveis) estão no repositório Backend: `docs/ROTEIRO-E-APRESENTACAO.pdf`.
