# Changelog — Frontend

## 22/11/2026 — Como rodar, corrigido

- **Corrigido:** a entrada de 11/11 dizia que o Backend não serve a tela e que não existe `lab.py demo`. Os dois
  existem desde 09/11 (`gateway.frontend_dir` e `lab.py demo` no Backend). O README e o EXPLICACAO voltaram a mostrar o
  gateway servindo a tela na mesma origem. O servidor estático separado, documentado em 11/11, ficou como alternativa
  para desenvolver só a tela.

## 11/11/2026 — Instruções para executar

- **Corrigido:** documentação de execução para refletir que o Backend não serve o Frontend e não possui `lab.py demo`.
- **Documentado:** build/servidor estático, inicialização separada do gateway, URL da API, CORS e dependência dos runtimes.

## 09/11/2026 — Plano v2

Detalhes e motivos no Backend: `docs/MUDANCAS.md` (itens 3, 6, 10, 11 e 16). Estado anterior: tag `antes-do-plano-v2`.

- **Novo:** contrato v1.1 — evento `queued` (posição na fila), `meta` repetido quando o pedido muda de nó antes do
  primeiro delta, `done.finish_reason` `length` aceito em texto.
- **Novo:** posição na fila ao vivo, painel de métricas do pedido e prontuário em cartões (`cards.js`).
- **Alterado:** a URL do Backend é a origem da página quando o gateway serve a tela; limite de entrada de 8.000
  caracteres, igual ao gateway.
- **Removido:** opção "Automático" (roteador desligado por padrão) e o código morto `isPrivateIpv4`.
- **Novo:** 3 testes do controller; CI no GitHub Actions; diagramas no `EXPLICACAO.md`.

## 02/11/2026

- Cliente web com `fetch` + SSE, máquina de estados estrita, parser SSE incremental e download do resultado validado
  (commits do Daniel).
