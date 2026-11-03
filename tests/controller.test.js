import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../src/features/generation/controller.js';

function sseResponse(events) {
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  const firstMeta = events.find(([event]) => event === 'meta')?.[1];
  return new Response(body, { headers: { 'content-type': 'text/event-stream', ...(firstMeta ? { 'x-request-id': firstMeta.request_id } : {}) } });
}

const meta = (request_id, domain = 'redes', schema = null) => ({ request_id, domain, model: 'model-a', node: 'node-a', attempt: 1, schema });
const done = (request_id) => ({ request_id, finish_reason: 'stop', completion_tokens: null, tokens_source: 'unknown' });

async function withFetch(response, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;
  try { await callback(); } finally { globalThis.fetch = originalFetch; }
}

test('controller forwards result data to the UI before completing', async () => {
  const result = { data: { answer: 'extraído' }, schema: 'prontuario-v1' };
  await withFetch(sseResponse([
    ['meta', meta('req-1', 'prontuario', 'prontuario-v1')],
    ['result', result],
    ['done', done('req-1')],
  ]), async () => {
    const events = [];
    const states = [];
    const controller = createController({ onEvent: (item) => events.push(item), onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'prontuario', input: 'texto sintético', trustRemoteOrigin: true });

    assert.deepEqual(events, [
      { event: 'result', data: result },
      { event: 'done', data: done('req-1') },
    ]);
    assert.equal(states.at(-1).state, 'complete');
  });
});

test('Redes delta events reach the UI and complete without a structured result', async () => {
  await withFetch(sseResponse([
    ['meta', meta('req-2')],
    ['delta', { seq: 1, text: 'Resposta de Redes.' }],
    ['done', done('req-2')],
  ]), async () => {
    const events = [];
    const states = [];
    const controller = createController({ onEvent: (item) => events.push(item), onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'redes', input: 'pergunta', trustRemoteOrigin: true });

    assert.deepEqual(events, [
      { event: 'delta', data: { seq: 1, text: 'Resposta de Redes.' } },
      { event: 'done', data: done('req-2') },
    ]);
    assert.equal(states.at(-1).state, 'complete');
    assert.equal(states.at(-1).resultValid, false);
  });
});

test('controller rejects done without meta and incomplete result streams', async () => {
  for (const events of [
    [['done', done('req-x')]],
    [['meta', meta('req-x', 'prontuario', 'prontuario-v1')], ['done', done('req-x')]],
  ]) {
    await withFetch(sseResponse(events), async () => {
      const states = [];
      const controller = createController({ onEvent: () => {}, onState: (item) => states.push(item) });
      await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'redes', input: 'pergunta', trustRemoteOrigin: true });
      assert.equal(states.at(-1).state, 'error');
    });
  }
});

test('controller does not accept error before required meta', async () => {
  const states = [];
  await withFetch(sseResponse([['error', { code: 'backend_error', message: 'x', partial: false, retryable: true }]]), async () => {
    const controller = createController({ onEvent: () => {}, onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'redes', input: 'pergunta', trustRemoteOrigin: true });
  });
  assert.equal(states.at(-1).state, 'error');
  assert.match(states.at(-1).error.message, /meta/);
});

test('controller rejects invalid delta sequence and duplicate terminal events', async () => {
  const states = [];
  await withFetch(sseResponse([
    ['meta', meta('req-seq')], ['delta', { seq: 2, text: 'x' }], ['done', done('req-seq')],
  ]), async () => {
    const controller = createController({ onEvent: () => {}, onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'redes', input: 'pergunta', trustRemoteOrigin: true });
  });
  assert.equal(states.at(-1).state, 'error');
});

test('controller records TTFT on first non-empty delta rather than meta', async () => {
  let tick = 0;
  const originalNow = performance.now;
  performance.now = () => [100, 130, 160][Math.min(tick++, 2)];
  try {
    const states = [];
    await withFetch(sseResponse([
      ['meta', meta('req-ttft')], ['delta', { seq: 1, text: '' }], ['delta', { seq: 2, text: 'x' }], ['done', done('req-ttft')],
    ]), async () => {
      const controller = createController({ onEvent: () => {}, onState: (item) => states.push(item) });
      await controller.run({ baseUrl: 'https://backend.test', token: 'test-token', domain: 'redes', input: 'pergunta', trustRemoteOrigin: true });
    });
    assert.equal(states.filter((item) => item.ttftObservedMs !== undefined).at(-1).ttftObservedMs, 30);
  } finally { performance.now = originalNow; }
});

test('controller ignores callbacks from an aborted older run', async () => {
  const originalFetch = globalThis.fetch;
  let releaseFirst;
  let call = 0;
  globalThis.fetch = async (_url, { signal }) => {
    call += 1;
    if (call === 1) {
      await new Promise((resolve) => { releaseFirst = resolve; signal.addEventListener('abort', resolve, { once: true }); });
    }
    return sseResponse([['meta', meta('req-new')], ['delta', { seq: 1, text: 'new' }], ['done', done('req-new')]]);
  };
  try {
    const events = [];
    const states = [];
    const controller = createController({ onEvent: (item) => events.push(item), onState: (item) => states.push(item) });
    const first = controller.run({ baseUrl: 'https://backend.test', token: 'token', domain: 'redes', input: 'old', trustRemoteOrigin: true });
    const second = controller.run({ baseUrl: 'https://backend.test', token: 'token', domain: 'redes', input: 'new', trustRemoteOrigin: true });
    releaseFirst?.();
    await Promise.all([first, second]);
    assert.equal(events.some((item) => item.data?.text === 'new'), true);
    assert.equal(states.at(-1).state, 'complete');
  } finally { globalThis.fetch = originalFetch; }
});

test('controller refuses to send a bearer token to an untrusted remote origin', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('fetch must not run'); };
  try {
    const states = [];
    const controller = createController({ onEvent: () => {}, onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'https://untrusted.example', token: 'secret-token', domain: 'redes', input: 'test' });
    assert.equal(fetchCalled, false);
    assert.equal(states.at(-1).state, 'error');
    assert.match(states.at(-1).error.message, /Confirme que confia/);
  } finally { globalThis.fetch = originalFetch; }
});

test('controller requires HTTPS for remote origins and rejects URL credentials', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('fetch must not run'); };
  try {
    const states = [];
    const controller = createController({ onEvent: () => {}, onState: (item) => states.push(item) });
    await controller.run({ baseUrl: 'http://backend.example', token: 'secret-token', domain: 'redes', input: 'test', trustRemoteOrigin: true });
    assert.equal(states.at(-1).state, 'error');
    assert.match(states.at(-1).error.message, /HTTPS/);
    await controller.run({ baseUrl: 'https://user:password@backend.example', token: 'secret-token', domain: 'redes', input: 'test', trustRemoteOrigin: true });
    assert.equal(fetchCalled, false);
    assert.match(states.at(-1).error.message, /inválida ou insegura/);
  } finally { globalThis.fetch = originalFetch; }
});
