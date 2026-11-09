# UFES Redes Trab2 — Frontend

Tela web do Projeto 1 (Redes de Computadores, UFES). É HTML, CSS e JavaScript nativo, sem dependências. A tela manda
o pedido ao gateway por `fetch` POST e lê a resposta em **SSE**, mostrando:

- a **posição na fila** ao vivo;
- o texto chegando token a token;
- as **métricas do pedido** (TTFT, latência, tokens/s);
- o prontuário validado em **cartões**.

Diagramas e código explicados: [EXPLICACAO.md](EXPLICACAO.md).

## Rodar

A tela não precisa de servidor próprio: o gateway a serve na mesma origem da API, sem CORS. Com os três repositórios
lado a lado:

```bash
cd ../UFES_Redes_Trab2_Backend
python3 lab.py demo        # abre https://127.0.0.1:8443 e imprime o token para colar na tela
```

Para servir de outra origem, use `npm run build` e sirva `dist/` por HTTPS. Nesse caso, configure a origem exata em
`gateway.cors_origins` no Backend.

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
