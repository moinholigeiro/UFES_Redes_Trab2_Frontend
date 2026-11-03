# UFES Redes Trab2 — Frontend

Cliente web leve sem dependências de runtime. Só fala com a API pública do Backend por `fetch` POST + SSE com Bearer no header; não sabe endereço/modelo de nós.

## Desenvolvimento e testes

Requer Node 20+ (Node 24 usado no desenvolvimento). `npm test` executa parser SSE com Node test runner; `npm run build` gera `dist/`. Sirva `dist/` por HTTPS, preferencialmente na mesma origem do proxy `/v1`. Não abra `index.html` via `file://` em produção.

Para Backend em origem HTTPS diferente, marque a confirmação de confiança antes de enviar o Bearer. Configure essa origem exata na allowlist `gateway.cors_origins` do Backend; evite wildcard e prefira proxy de mesma origem. HTTP remoto e URLs com usuário/senha embutidos são recusados pelo cliente.

Token e resultados ficam somente em memória; logout limpa os campos e dados. Saídas são inseridas como texto (sem HTML/Markdown ativo). Exportação estruturada é habilitada apenas após `result` e `done` consistentes. Use exclusivamente textos sintéticos, nunca dados reais de saúde.
