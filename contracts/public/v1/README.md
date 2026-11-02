# Contrato público v1

A fonte executável dos DTOs/eventos segue em `src/llm_gateway/protocol.py` e o stream é servido por FastAPI. Este JSON Schema registra o envelope de dados de `meta`, `delta`, `result`, `done` e `error`; validação da sequência também exige `result` (quando schema configurado) seguido por `done`, ou exatamente um `error`. O Frontend deve importar/sincronizar esta versão e não inferir tokens a partir da quantidade de eventos `delta`.
