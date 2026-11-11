# UFES Redes Trab2 — Frontend

Tela web do Projeto 1 (Redes de Computadores, UFES). É HTML, CSS e JavaScript nativo, sem dependências. A tela manda
o pedido ao gateway por `fetch` POST e lê a resposta em **SSE**, mostrando:

- a **posição na fila** ao vivo;
- o texto chegando em trechos durante a geração;
- as **métricas do pedido** (TTFT, latência, tokens/s);
- o prontuário validado em **cartões**.

Diagramas e código explicados: [EXPLICACAO.md](EXPLICACAO.md).

## Rodar

A interface é estática; o Backend atual **não** serve os arquivos do Frontend e não há comando `lab.py demo`. Para
abrir a página, na raiz deste repositório execute:

```bash
npm run build
python3 -m http.server 5173 --directory dist
```

Abra <http://127.0.0.1:5173>. Não abra `index.html` diretamente como arquivo (`file://`). O primeiro comando cria
`dist/`; o segundo inicia um servidor estático de desenvolvimento. Para apenas conferir a interface, isso basta.

Para enviar pedidos, o gateway e os runtimes LLM também precisam estar ativos. Em outro terminal, na raiz do
repositório Backend, inicie o ambiente e o gateway com o perfil mínimo:

```bash
devenv shell
llm-gateway serve --config configs/cpu_minimal.toml
```

Esse perfil usa `http://127.0.0.1:8080` para a API, permite CORS da origem `http://127.0.0.1:5173` e não exige token.
Ele pressupõe que os runtimes LLM estejam rodando nas portas `8101` e `8102`; iniciar o gateway sozinho não inicia os
modelos. Na interface, informe `http://127.0.0.1:8080` em **URL do Backend** (a URL inicial é a origem da página) e,
para esse perfil sem autenticação, deixe o token vazio. O servidor estático da página pode continuar rodando no
primeiro terminal.

Se servir a interface em outra origem, adicione a origem exata do Frontend a `gateway.cors_origins` no arquivo de
configuração do Backend e use HTTPS para origens remotas. A página aceita HTTP apenas em loopback; para um gateway
remoto exige HTTPS e confirmação explícita antes de enviar o token. Veja o README do Backend para configurar TLS,
credenciais e runtimes.

## Testes

```bash
npm test          # Node 20+; 15 testes do parser SSE e da máquina de estados
npm run build     # copia index.html e src/ para dist/
```

O CI do GitHub Actions roda os dois a cada push.

## Contrato

A tela segue o contrato público **v1.1** do Backend. A cópia está em `contracts/public/v1/`, e o Backend confere se é
idêntica com `scripts/check-public-contract.sh`. Eventos: `meta`, `queued`, `delta`, `result`, `done` e `error`.

## Segurança

- Token e resultados ficam só em memória; "Limpar sessão" apaga tudo.
- Toda saída do modelo entra como texto (`textContent`), nunca como HTML.
- A CSP permite scripts só da própria origem.
- HTTP só é aceito para `localhost`; URL remota precisa de HTTPS e de confirmação explícita antes de mandar o token.
- **Use apenas textos sintéticos**: nunca dados reais de saúde.

Histórico: [CHANGELOG.md](CHANGELOG.md).
