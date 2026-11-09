# Contrato público v1.1

A fonte executável dos eventos é `src/llm_gateway/api.py` (`_event_stream`) e `src/llm_gateway/scheduler.py`.
`events.json` descreve o conteúdo de cada evento. O Frontend guarda uma cópia idêntica, conferida por
`scripts/check-public-contract.sh`.

## Ordem dos eventos de um pedido

```text
meta → queued* → [meta → queued*]* → delta* → result? → done
                                          ↘ error (pode encerrar em qualquer ponto)
```

- `meta` sai na admissão, antes de qualquer outro evento. Sai **de novo** se o pedido mudar de nó antes do
  primeiro `delta` (failover ou migração da fila de um nó que caiu); o `attempt` aumenta.
- `queued {position, node}` informa a posição na fila do nó, a cada mudança. Posição 1 = o próximo a ser
  atendido. É informativo: o servidor pode pular atualizações se o cliente estiver lento.
- `delta {seq, text}`: trecho gerado. **Não é um token**; a contagem de tokens vem no `done`.
- `result {schema, data}`: só em domínios de extração JSON, depois da validação.
- `done.finish_reason`: `stop` (o modelo terminou) ou `length` (cortado no limite de tokens, só em texto).
- Exatamente um evento terminal por pedido: `done` ou `error`.
- Comentários SSE (`: keepalive`) não são eventos.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| v1 | 02/11/2026 | `meta`, `delta`, `result`, `done`, `error` |
| v1.1 | 09/11/2026 | Novo evento `queued`; `meta` na admissão e repetido em troca de nó; `done.finish_reason` aceita `length` |
