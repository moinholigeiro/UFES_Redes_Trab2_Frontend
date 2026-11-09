import { createController } from './features/generation/controller.js';
import { renderProntuario } from './features/generation/cards.js';

const $ = (id) => document.getElementById(id);
const form = $('generation');
const output = $('output');
let finalResult = null;

// Servida pelo próprio gateway (lab.py), a tela fala com a mesma origem: sem CORS e sem digitar a URL.
if (location.protocol === 'https:' || location.protocol === 'http:') $('api-url').value = location.origin;

const STATUS = {
  connecting: 'Conectando',
  waiting: 'Aguardando o gateway',
  queued: 'Na fila',
  generating: 'Gerando — prévia não validada',
  validating: 'Validando resultado',
  complete: 'Concluído',
  cancelled: 'Cancelado',
};

function setQueue(text) {
  $('queue').textContent = text;
  $('queue').hidden = !text;
}

function clearView() {
  output.textContent = '';
  $('meta').replaceChildren();
  $('metrics').replaceChildren();
  $('cards').replaceChildren();
  setQueue('');
  finalResult = null;
  $('download').disabled = true;
}

function renderPairs(target, pairs) {
  target.replaceChildren();
  for (const [key, value] of pairs) {
    const dt = document.createElement('dt'); dt.textContent = key;
    const dd = document.createElement('dd'); dd.textContent = String(value ?? '—');
    target.append(dt, dd);
  }
}

function renderMeta(meta) {
  renderPairs($('meta'), [
    ['request_id', meta.request_id],
    ['domínio', meta.domain],
    ['modelo', meta.model],
    ['nó', meta.node],
    ['tentativa', meta.attempt],
    ['nós tentados', (meta.attempt_nodes ?? []).join(' → ')],
  ]);
}

// Métricas medidas no navegador (TTFT e E2E) e informadas pelo gateway (tokens do runtime).
function renderMetrics(state) {
  const done = state.done ?? {};
  const tokens = Number.isInteger(done.completion_tokens) ? done.completion_tokens : null;
  const generationMs = state.ttftObservedMs === null ? null : state.e2eObservedMs - state.ttftObservedMs;
  const tokensPerSecond = tokens && generationMs > 0 ? (tokens / (generationMs / 1000)).toFixed(1) : null;
  renderPairs($('metrics'), [
    ['TTFT (navegador)', state.ttftObservedMs === null ? null : `${state.ttftObservedMs} ms`],
    ['latência fim a fim', `${state.e2eObservedMs} ms`],
    ['tokens gerados', tokens ?? 'não informado pelo runtime'],
    ['tokens/s (geração)', tokensPerSecond],
    ['fim', done.finish_reason === 'length' ? 'cortada no limite de tokens' : 'completa'],
  ]);
}

const controller = createController({
  onState(state) {
    const errorText = `Erro: ${state.error?.message ?? state.error?.error?.message ?? state.error?.error?.code ?? 'requisição falhou'}`;
    $('status').textContent = state.state === 'error' ? errorText : (STATUS[state.state] ?? state.state);
    $('cancel').disabled = !['connecting', 'waiting', 'queued', 'generating', 'validating'].includes(state.state);
    $('retry').disabled = !['error', 'cancelled'].includes(state.state);
    if (state.meta && ['waiting', 'queued', 'generating'].includes(state.state)) renderMeta(state.meta);
    if (state.state === 'queued') {
      setQueue(state.queuePosition === 1
        ? `Você é o próximo na fila do nó ${state.node}.`
        : `Posição na fila do nó ${state.node}: ${state.queuePosition}º`);
    }
    if (state.state === 'generating') setQueue('');
    if (state.state === 'complete') {
      setQueue('');
      renderMetrics(state);
      if (state.resultValid && state.result) {
        finalResult = state.result;
        $('cards').replaceChildren(renderProntuario(state.result.data));
      }
      $('download').disabled = !state.resultValid || !finalResult;
    }
    if (state.state === 'error' || state.state === 'cancelled') {
      setQueue('');
      finalResult = null;
      $('download').disabled = true;
    }
  },
  onEvent({ event, data }) {
    if (event === 'delta') output.textContent += data.text;
    if (event === 'result') finalResult = data;
    if (event === 'error') finalResult = null;
  },
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearView();
  let input = $('input').value;
  const file = $('file').files?.[0];
  if (!input && !file) { $('status').textContent = 'Informe um texto ou selecione um arquivo.'; return; }
  if (file) {
    if (file.size > 64 * 1024 || !file.name.toLowerCase().endsWith('.txt')) { $('status').textContent = 'Arquivo inválido ou maior que 64 KiB'; return; }
    try { input = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
    catch { $('status').textContent = 'O arquivo não contém UTF-8 válido.'; return; }
  }
  if (new TextEncoder().encode(input).byteLength > 64 * 1024 || input.length > 8000) { $('status').textContent = 'A entrada excede o limite do Backend (64 KiB / 8.000 caracteres).'; return; }
  await controller.run({ baseUrl: $('api-url').value.trim(), token: $('token').value, domain: $('domain').value, input, trustRemoteOrigin: $('trust-origin').checked });
});
$('api-url').addEventListener('input', () => { $('trust-origin').checked = false; });
$('cancel').addEventListener('click', () => controller.cancel());
$('retry').addEventListener('click', () => { clearView(); void controller.retry(); });
$('logout').addEventListener('click', () => { controller.clear(); $('token').value = ''; $('trust-origin').checked = false; clearView(); $('status').textContent = 'Sessão limpa'; });
$('download').addEventListener('click', () => {
  if (!finalResult) return;
  const blob = new Blob([JSON.stringify(finalResult.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = 'resultado-validado.json'; link.click(); URL.revokeObjectURL(url);
});
