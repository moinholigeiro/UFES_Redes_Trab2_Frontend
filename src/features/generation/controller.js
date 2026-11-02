import { parseSSE } from '../../api/sse.js';

export function createController({ onState, onEvent }) {
  let active = null;
  let lastRequest = null;
  const run = async ({ baseUrl, token, domain, input }) => {
    active?.abort();
    const controller = new AbortController();
    active = controller;
    lastRequest = { baseUrl, token, domain, input };
    const start = performance.now();
    let sawDone = false;
    let sawError = false;
    let sawResult = false;
    let requestId = null;
    let resolvedSchema = null;
    onState({ state: 'connecting' });
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/generate`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain, input }),
      });
      if (!response.ok) {
        let problem;
        try { problem = await response.json(); } catch { problem = { error: { code: `http_${response.status}` } }; }
        onEvent({ event: 'http_error', data: { status: response.status, retryAfter: response.headers.get('retry-after'), ...problem } });
        onState({ state: 'error', error: problem });
        return;
      }
      if (!response.body) throw new Error('O servidor não forneceu um stream.');
      onState({ state: 'waiting' });
      for await (const frame of parseSSE(response.body)) {
        let data;
        try { data = JSON.parse(frame.data); } catch { throw new Error('Evento SSE contém JSON inválido.'); }
        if (frame.event === 'meta') {
          requestId = data.request_id;
          resolvedSchema = data.schema ?? null;
          onState({ state: 'generating', meta: data, requestId, ttftObservedMs: Math.round(performance.now() - start) });
        } else if (frame.event === 'result') {
          sawResult = true;
          onState({ state: 'validating', meta: data });
        } else if (frame.event === 'done') {
          if (sawError || (resolvedSchema && !sawResult)) throw new Error('Conclusão sem resultado validado consistente.');
          sawDone = true;
          onEvent({ event: 'done', data });
        } else if (frame.event === 'error') {
          sawError = true;
          sawResult = false;
          onEvent({ event: 'error', data });
          onState({ state: 'error', error: data });
        } else {
          onEvent({ event: frame.event, data });
        }
      }
      if (!sawDone && !sawError) throw new Error('Stream encerrou sem evento terminal.');
      if (sawDone) onState({ state: 'complete', requestId, e2eObservedMs: Math.round(performance.now() - start), resultValid: sawResult });
    } catch (error) {
      if (error.name === 'AbortError') onState({ state: 'cancelled' });
      else onState({ state: 'error', error: { message: error.message } });
    } finally {
      if (active === controller) active = null;
    }
  };
  return {
    run,
    cancel: () => active?.abort(),
    retry: () => lastRequest && run({ ...lastRequest }),
    clear: () => { active?.abort(); active = null; lastRequest = null; },
  };
}
