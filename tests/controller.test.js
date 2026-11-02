import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../src/features/generation/controller.js';

function sseResponse(events) {
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function withFetch(response, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;
  try { await callback(); } finally { globalThis.fetch = originalFetch; }
}

test('controller forwards result data to the UI before completing', async () => {
  const result = { data: { answer: 'extraído' }, schema: 'prontuario-v1' };
  await withFetch(sseResponse([
    ['meta', { request_id: 'req-1', schema: 'prontuario-v1' }],
    ['result', result],
    ['done', { request_id: 'req-1' }],
  ]), async () => {
    const events = [];
    const states = [];
    const controller = createController({ onEvent: (item) => events.push(item), onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'prontuario', input: 'texto sintético' });

    assert.deepEqual(events, [
      { event: 'result', data: result },
      { event: 'done', data: { request_id: 'req-1' } },
    ]);
    assert.equal(states.at(-1).state, 'complete');
  });
});

test('Redes delta events reach the UI and complete without a structured result', async () => {
  await withFetch(sseResponse([
    ['meta', { request_id: 'req-2', domain: 'redes', schema: null }],
    ['delta', { text: 'Resposta de Redes.' }],
    ['done', { request_id: 'req-2' }],
  ]), async () => {
    const events = [];
    const states = [];
    const controller = createController({ onEvent: (item) => events.push(item), onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'redes', input: 'pergunta' });

    assert.deepEqual(events, [
      { event: 'delta', data: { text: 'Resposta de Redes.' } },
      { event: 'done', data: { request_id: 'req-2' } },
    ]);
    assert.equal(states.at(-1).state, 'complete');
    assert.equal(states.at(-1).resultValid, false);
  });
});
