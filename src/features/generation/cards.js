// Cartões do prontuário validado (schema prontuario-v1 do Backend). Tudo entra como texto
// (textContent), nunca como HTML: o conteúdo vem de um modelo de linguagem e não é confiável.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(title, body) {
  const box = el('article', 'card');
  box.append(el('h3', null, title), body);
  return box;
}

function list(items, empty) {
  if (!items || items.length === 0) return el('p', 'empty', empty);
  const ul = el('ul');
  for (const item of items) ul.append(el('li', null, item));
  return ul;
}

function pairs(entries) {
  const dl = el('dl');
  for (const [key, value] of entries) dl.append(el('dt', null, key), el('dd', null, value ?? '—'));
  return dl;
}

export function renderProntuario(data) {
  const grid = el('div', 'cards');
  grid.append(
    card('Paciente', pairs([
      ['idade', data.idade === null || data.idade === undefined ? null : `${data.idade} anos`],
      ['sexo', data.sexo],
      ['queixa principal', data.queixa_principal],
    ])),
    card('Sinais vitais', pairs([
      ['pressão arterial', data.sinais_vitais?.pa],
      ['frequência cardíaca', data.sinais_vitais?.fc],
      ['temperatura (°C)', data.sinais_vitais?.temp_c],
      ['saturação O₂', data.sinais_vitais?.spo2],
    ])),
    card('Diagnósticos', list(data.diagnosticos, 'nenhum no texto')),
    card('Medicamentos', list(
      (data.medicamentos ?? []).map((m) => [m.nome, m.dose, m.via, m.frequencia].filter(Boolean).join(' · ')),
      'nenhum no texto',
    )),
    card('Alergias', data.alergias === null ? el('p', 'empty', 'não informado') : list(data.alergias, 'nenhuma')),
  );
  return grid;
}
