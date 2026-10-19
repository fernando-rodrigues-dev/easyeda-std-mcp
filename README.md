# EasyEDA Standard MCP

Servidor MCP local para conectar um assistente compatível com MCP ao **EasyEDA Standard**. Permite ler e editar esquemas e trabalhar com uma PCB aberta usando a API do editor.

O projeto está em desenvolvimento. A integração foi desenvolvida para o EasyEDA Standard **6.5.51**; outras versões precisam de validação. EasyEDA Pro usa uma API diferente.

## Instalação

Requisitos: Node.js 20 ou superior, npm, EasyEDA Standard e um cliente MCP com transporte **stdio**. O uso no Windows foi o alvo inicial. Os testes automatizados usam documentos sintéticos e dispensam EasyEDA.

```sh
git clone https://github.com/fernando-rodrigues-dev/easyeda-std-mcp.git
cd easyeda-std-mcp
npm ci
npm run setup
npm test
```

No PowerShell, use `npm.cmd` se a política local impedir a execução de `npm.ps1`.

O setup gera um token próprio desta instalação e os seguintes arquivos **locais, ignorados pelo Git**:

- `Conectar-MCP.js`: script avulso de conexão.
- `extension/main.js`: extensão com a mesma conexão.
- `config-codex.toml` e `mcp.json`: exemplos de configuração com os caminhos desta instalação.
- `data/bridge-token.txt`: credencial da ponte local.

Nunca publique esses arquivos gerados. Não é necessário compartilhar nenhum token para colaborar no código.

### Conectar ao editor

Escolha uma opção:

1. No EasyEDA, abra **Avançado > Executar Script**, carregue `Conectar-MCP.js` e execute. Repita ao reiniciar/recarregar o editor.
2. Para conexão automática, abra **Avançado > Configurações de extensões > Carregar extensão**, selecione `manifest.json`, `main.js` e `icon.svg` de `extension/`, carregue e habilite. Ao atualizar o código, gere novamente a extensão e recarregue-a.

Não execute simultaneamente o script e a extensão. O botão deve mostrar **MCP conectado** quando a ponte estiver ativa.

### Conectar ao cliente MCP

Configure um servidor stdio chamado `easyeda_std` usando o exemplo local de `mcp.json` ou `config-codex.toml`. O processo é `node`, com o caminho absoluto de `src/server.mjs` como argumento e esta pasta como diretório de trabalho.

Para clientes que leem `[mcp_servers]` de `~/.codex/config.toml`, há um registro opcional:

```sh
node scripts/setup.mjs --register
```

Esse modo modifica a configuração local do cliente, preserva uma entrada `easyeda_std` existente e guarda backup local quando necessário. O setup sem `--register` apenas gera arquivos nesta instalação. Outros clientes devem ser configurados manualmente.

Use `easyeda_status` para iniciar/verificar a ponte. Também é possível deixá-la rodando em um terminal separado:

```sh
npm run bridge
```

Depois de reiniciar o computador, o cliente MCP inicia seu servidor conforme a própria configuração; o primeiro uso de uma ferramenta inicia a ponte. O script/extensão precisa estar carregado no EasyEDA.

## O que faz

- Ler a folha ativa, símbolos, pinos, fios, redes e coordenadas.
- Inserir símbolos da biblioteca comum ou por UUID do **Standard**.
- Alterar referências/valores; desenhar fios ortogonais, rótulos, flags, junções e textos.
- Mover e girar objetos; exportar o fonte JSON e criar backups antes de edições.
- Ler footprints, pads, camadas, trilhas, furos e redes da PCB.
- Posicionar/girar footprints existentes, espelhar componentes, desenhar trilhas e contornos e criar anotações.
- Conectar pads da mesma rede com rotas simples ou pontos intermediários.
- Aplicar política de cobre somente na face inferior e conferir conflitos geométricos/continuidade.

São **33 ferramentas**: 19 gerais/de esquema e 14 de PCB. Consulte [as ferramentas](docs/TOOLS.md) e [as limitações conhecidas](docs/LIMITATIONS.md).

As ferramentas de esquema usam unidades STD de **10 mil**. As ferramentas de PCB usam **milímetros relativos à origem da placa**, com x para a direita e y para baixo. Leia as coordenadas e a revisão antes de editar. Havendo múltiplas sessões, informe `session_id`.

Uma edição usa `expected_revision`, verifica a aba ativa e cria backup em `data/backups`. Alterações realizadas no editor entre a leitura e a edição devem ser relidas. O MCP não altera o esquemático ao rotear uma PCB e confere a identidade dos pads/redes ao aplicar layouts.

## Limites e cuidados

O MCP não implementa autorroteamento completo, ERC/DRC nativo, simulação ou geração de Gerbers. A conferência geométrica não substitui inspeção no editor, revisão elétrica/mecânica e ensaios. Testes unitários usam uma API simulada, sem garantir todos os comportamentos da instalação real.

**Importação/substituição de fonte PCB é experimental.** Foi observada perda de pads e área de cobre em uma atualização por `applySource` no editor. Há backup, mas a detecção posterior não desfaz automaticamente uma alteração parcial. Teste essas operações em uma cópia descartável e confira pads, redes e áreas após a escrita. Para recuperar, abra o JSON de backup no EasyEDA. Veja [as limitações](docs/LIMITATIONS.md).

Mover componentes não acompanha trilhas existentes. O verificador também não certifica distâncias entre todos os pads, sobreposição de corpos, bordas, corrente suportada ou dissipação.

## Dados e conexão

A ponte escuta exclusivamente em `127.0.0.1:3579` e exige o token local. Não oferece uma ferramenta de execução arbitrária de código nem um serviço acessível pela rede externa. O cliente MCP escolhido recebe os dados retornados pelas ferramentas; avalie as políticas desse cliente antes de abrir projetos confidenciais.

Backups/exportações podem conter o circuito completo e metadados do documento. A pasta `data/`, os scripts gerados e configurações locais ficam fora do repositório. O código não inclui projetos reais de usuários, histórico de conversa ou credenciais de uma instalação.

Variáveis opcionais:

| Variável | Função |
|---|---|
| `EASYEDA_MCP_DATA` | Pasta local de tokens, backups, exportações e políticas de PCB. |
| `EASYEDA_MCP_PORT` | Porta da ponte; padrão 3579. Gere novamente a extensão após alterar. A política de conexão do editor pode limitar outras portas. |
| `CODEX_HOME` | Pasta usada somente pelo registro opcional `--register`. |

Não exponha a ponte por túnel, proxy público ou encaminhamento de porta. Qualquer programa com acesso ao token local poderá usar as ações permitidas. Consulte [SECURITY.md](SECURITY.md).

## Desenvolvimento

```sh
npm ci
npm test
npm run test:protocol
npm run check:public
```

O teste de protocolo valida a descoberta das ferramentas stdio sem abrir nem modificar o EasyEDA. `check:public` examina os arquivos rastreados pelo Git, sem imprimir o conteúdo de possíveis segredos; não substitui revisão humana.

Veja [CONTRIBUTING.md](CONTRIBUTING.md). A definição da licença de redistribuição fica a cargo do mantenedor; esta publicação não acrescenta uma licença de código aberto.

## Referências

- [API oficial do EasyEDA Standard](https://docs.easyeda.com/en/API/3-API-List/)
- [Scripts e extensões](https://docs.easyeda.com/en/API/1-How-to-Use-API/)
- [Formato de esquemáticos](https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/)
- [Formato de PCB](https://docs.easyeda.com/en/DocumentFormat/3-EasyEDA-PCB-File-Format/)

Projeto independente, sem vínculo oficial com EasyEDA, JLCPCB ou os fornecedores de clientes MCP.

