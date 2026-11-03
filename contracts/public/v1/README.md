# Contrato público v1

A fonte executável dos DTOs/eventos segue em `src/llm_gateway/protocol.py` e o stream é servido por FastAPI. Este JSON Schema registra o envelope de dados de `meta`, `delta`, `result`, `done` e `error`; validação da sequência também exige `result` (quando schema configurado) seguido por `done`, ou exatamente um `error`. O Frontend deve importar/sincronizar esta versão e não inferir tokens a partir da quantidade de eventos `delta`.
# Contrato público v1

`events.json` é a cópia do schema-envelope mantido pelo Backend em `../UFES_Redes_Trab2_Backend/contracts/public/v1/events.json`. Verifique identidade com `cmp` durante integração. As regras da sequência são: exatamente um `meta` primeiro; zero ou mais `delta` com sequência começando em 1; em extração, um `result` compatível com o schema antes de `done`; exatamente um terminal `done` ou `error`; o frame SSE precisa do delimitador de linha em branco. EOF no meio de frame não é terminal válido.
