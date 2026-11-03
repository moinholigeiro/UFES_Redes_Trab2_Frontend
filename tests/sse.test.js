import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSSE } from '../src/api/sse.js';

function stream(parts) {
  return new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(part); controller.close(); } });
}
const enc = new TextEncoder();

test('SSE parser handles split UTF-8, CRLF, comments and multiple data lines', async () => {
  const bytes = enc.encode(': keepalive\r\nevent: delta\r\ndata: {"text":"ação\n').slice();
  const cut = bytes.indexOf(0xc3);
  const chunks = [bytes.slice(0, cut + 1), bytes.slice(cut + 1), enc.encode('data: segunda linha\r\n\r\n')];
  const frames = [];
  for await (const frame of parseSSE(stream(chunks))) frames.push(frame);
  assert.deepEqual(frames, [{ event: 'delta', data: '{"text":"ação\nsegunda linha' }]);
});

test('SSE parser does not emit a final unterminated frame', async () => {
  const frames = [];
  for await (const frame of parseSSE(stream([enc.encode('event: error\ndata: {"code":"eof"}')])) ) frames.push(frame);
  assert.deepEqual(frames, []);
});

test('SSE parser preserves CRLF split across network chunks', async () => {
  const frames = [];
  for await (const frame of parseSSE(stream([enc.encode('event: delta\r'), enc.encode('\ndata: {"text":"x"}\r'), enc.encode('\n\r'), enc.encode('\n')]))) frames.push(frame);
  assert.deepEqual(frames, [{ event: 'delta', data: '{"text":"x"}' }]);
});
