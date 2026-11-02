import { createController } from './features/generation/controller.js';

const $ = (id) => document.getElementById(id);
const form = $('generation');
const output = $('output');
let finalResult = null;
const controller = createController({
  onState(state) {
    $('status').textContent = ({
      connecting: 'Conectando', waiting: 'Aguardando primeiro evento', generating: 'Gerando — prévia não validada',
      validating: 'Validando resultado', complete: 'Concluído', cancelled: 'Cancelado', error: `Erro: ${state.error?.message ?? state.error?.error?.code ?? 'requisição falhou'}`,
    })[state.state] ?? state.state;
    $('cancel').disabled = !['connecting', 'waiting', 'generating', 'validating'].includes(state.state);
    $('retry').disabled = !['error', 'cancelled'].includes(state.state);
    if (state.state === 'generating' && state.meta) renderMeta(state.meta);
    if (state.state === 'complete') {
      $('status').textContent += ` · ${state.e2eObservedMs} ms (navegador)`;
      $('download').disabled = !finalResult;
    }
    if (state.state === 'error' || state.state === 'cancelled') { finalResult = null; $('download').disabled = true; }
  },
  onEvent({ event, data }) {
    if (event === 'delta') output.textContent += data.text;
    if (event === 'result') finalResult = data;
    if (event === 'error') finalResult = null;
  },
});
function renderMeta(meta) {
  $('meta').replaceChildren();
  for (const [key, value] of Object.entries({ request_id: meta.request_id, domínio: meta.domain, modelo: meta.model, política: 'resolvida pelo Backend', nó: meta.node, tentativa: meta.attempt })) {
    const dt = document.createElement('dt'); dt.textContent = key;
    const dd = document.createElement('dd'); dd.textContent = String(value ?? '');
    $('meta').append(dt, dd);
  }
}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); output.textContent = ''; $('meta').replaceChildren(); finalResult = null; $('download').disabled = true;
  let input = $('input').value;
  const file = $('file').files?.[0];
  if (file) {
    if (file.size > 256 * 1024 || !file.name.toLowerCase().endsWith('.txt')) { $('status').textContent = 'Arquivo inválido ou maior que 256 KiB'; return; }
    input = await file.text();
  }
  await controller.run({ baseUrl: $('api-url').value.trim(), token: $('token').value, domain: $('domain').value, input });
});
$('cancel').addEventListener('click', () => controller.cancel());
$('retry').addEventListener('click', () => { output.textContent = ''; finalResult = null; void controller.retry(); });
$('logout').addEventListener('click', () => { controller.clear(); $('token').value = ''; output.textContent = ''; $('meta').replaceChildren(); finalResult = null; $('download').disabled = true; $('status').textContent = 'Sessão limpa'; });
$('download').addEventListener('click', () => {
  if (!finalResult) return;
  const blob = new Blob([JSON.stringify(finalResult.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = 'resultado-validado.json'; link.click(); URL.revokeObjectURL(url);
});
