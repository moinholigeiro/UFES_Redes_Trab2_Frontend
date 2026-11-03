import { parseSSE } from '../../api/sse.js';

export function createController({ onState, onEvent }) {
  let active = null;
  let lastRequest = null;
  let epoch = 0;
  const run = async ({ baseUrl, token, domain, input, trustRemoteOrigin = false }) => {
    active?.abort();
    const runEpoch = ++epoch;
    const controller = new AbortController();
    active = controller;
    lastRequest = { baseUrl, token, domain, input, trustRemoteOrigin };
    const start = performance.now();
    let sawDone = false;
    let sawError = false;
    let sawResult = false;
    let sawMeta = false;
    let sawDelta = false;
    let expectedSeq = 1;
    let expectedResult = null;
    let ttftObservedMs = null;
    let requestId = null;
    let resolvedSchema = null;
    let terminalError = null;
    const state = (value) => { if (runEpoch === epoch) onState(value); };
    const event = (value) => { if (runEpoch === epoch) onEvent(value); };
    state({ state: 'connecting' });
    try {
      const backendUrl = new URL(baseUrl);
      const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
      if (!backendUrl.hostname) throw new Error('URL do Backend sem hostname.');
      const localHttp = backendUrl.protocol === 'http:' && localHosts.has(backendUrl.hostname);
      if (!['https:', 'http:'].includes(backendUrl.protocol) || backendUrl.username || backendUrl.password || backendUrl.search || backendUrl.hash || !['', '/'].includes(backendUrl.pathname)) {
        throw new Error('URL do Backend inválida ou insegura.');
      }
      if (!localHttp && backendUrl.protocol !== 'https:') {
        throw new Error('Conexões remotas exigem HTTPS.');
      }
      if (!localHosts.has(backendUrl.hostname) && !trustRemoteOrigin) {
        throw new Error('Confirme que confia na origem HTTPS antes de enviar o token.');
      }
      const response = await fetch(`${backendUrl.href.replace(/\/$/, '')}/v1/generate`, {
        method: 'POST', signal: controller.signal, redirect: 'error',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain, input }),
      });
      if (!response.ok) {
        let problem;
        try { problem = await response.json(); } catch { problem = { error: { code: `http_${response.status}` } }; }
        event({ event: 'http_error', data: { status: response.status, retryAfter: response.headers.get('retry-after'), ...problem } });
        state({ state: 'error', error: problem });
        return;
      }
      if (!response.body) throw new Error('O servidor não forneceu um stream.');
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) {
        throw new Error('O servidor não retornou Content-Type text/event-stream.');
      }
      const responseRequestId = response.headers.get('x-request-id');
      state({ state: 'waiting' });
      for await (const frame of parseSSE(response.body)) {
        if (runEpoch !== epoch) break;
        if (sawDone || sawError) throw new Error('O stream contém dados após evento terminal.');
        let data;
        try { data = JSON.parse(frame.data); } catch { throw new Error('Evento SSE contém JSON inválido.'); }
        if (frame.event === 'meta') {
          if (sawMeta || sawDelta || sawResult || typeof data.request_id !== 'string' || !data.request_id || typeof data.domain !== 'string' || typeof data.model !== 'string' || typeof data.node !== 'string' || !Number.isInteger(data.attempt) || data.attempt < 1) {
            throw new Error('Evento meta ausente, duplicado ou inválido.');
          }
          sawMeta = true;
          requestId = data.request_id;
          if (responseRequestId && responseRequestId !== requestId) throw new Error('Request ID do header diverge do evento meta.');
          resolvedSchema = data.schema === null || data.schema === undefined ? null : data.schema;
          if (resolvedSchema !== null && typeof resolvedSchema !== 'string') throw new Error('Schema do evento meta inválido.');
          state({ state: 'generating', meta: data, requestId });
        } else if (frame.event === 'delta') {
          if (!sawMeta || sawResult || typeof data.text !== 'string' || !Number.isInteger(data.seq) || data.seq !== expectedSeq) {
            throw new Error('Evento delta inválido ou fora de sequência.');
          }
          expectedSeq += 1;
          sawDelta = true;
          if (data.text.length > 0 && ttftObservedMs === null) {
            ttftObservedMs = Math.round(performance.now() - start);
            state({ state: 'generating', requestId, ttftObservedMs });
          }
          event({ event: 'delta', data });
        } else if (frame.event === 'result') {
          if (!sawMeta || !resolvedSchema || sawResult || !data || data.schema !== resolvedSchema || !data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
            throw new Error('Evento result inválido ou incompatível com meta.');
          }
          sawResult = true;
          expectedResult = data.data;
          event({ event: 'result', data });
          state({ state: 'validating', meta: data });
        } else if (frame.event === 'done') {
          if (!sawMeta || data.request_id !== requestId || (resolvedSchema && !sawResult) || (!resolvedSchema && sawResult) || data.finish_reason !== 'stop' || !(data.completion_tokens === null || (Number.isInteger(data.completion_tokens) && data.completion_tokens >= 0)) || !['backend_usage', 'unknown'].includes(data.tokens_source)) {
            throw new Error('Evento done ausente ou inconsistente com o resultado.');
          }
          sawDone = true;
          event({ event: 'done', data });
          break;
        } else if (frame.event === 'error') {
          if (!sawMeta) throw new Error('Evento error recebido antes do meta.');
          if (typeof data.code !== 'string' || typeof data.message !== 'string' || typeof data.partial !== 'boolean' || typeof data.retryable !== 'boolean' || data.partial !== sawDelta) {
            throw new Error('Evento error inválido.');
          }
          sawError = true;
          sawResult = false;
          terminalError = data;
          event({ event: 'error', data });
          state({ state: 'error', error: data });
          break;
        } else {
          throw new Error(`Evento SSE desconhecido: ${frame.event}`);
        }
      }
      if (runEpoch !== epoch) return;
      if (!sawDone && !sawError) throw new Error('Stream encerrou sem evento terminal.');
      if (sawError) state({ state: 'error', error: terminalError });
      if (sawDone) state({ state: 'complete', requestId, ttftObservedMs, e2eObservedMs: Math.round(performance.now() - start), resultValid: sawResult, result: sawResult ? { schema: resolvedSchema, data: expectedResult } : null });
    } catch (error) {
      if (runEpoch !== epoch) return;
      if (error.name === 'AbortError') state({ state: 'cancelled' });
      else state({ state: 'error', error: { message: error.message } });
    } finally {
      if (active === controller) active = null;
    }
  };
  return {
    run,
    cancel: () => {
      if (!active) return;
      const controller = active;
      active = null;
      epoch += 1;
      controller.abort();
      onState({ state: 'cancelled' });
    },
    retry: () => lastRequest && run({ ...lastRequest }),
    clear: () => { epoch += 1; active?.abort(); active = null; lastRequest = null; },
  };
}

function isPrivateIpv4(host) {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 || (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 169 && octets[1] === 254) || octets[0] === 0;
}
