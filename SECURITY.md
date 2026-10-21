# Segurança e privacidade

Este software controla o documento aberto no EasyEDA. Use um cliente MCP confiável e confira alterações antes de fabricar uma placa.

## Modo WebMCP no navegador

O script `cloud/Conectar-WebMCP.js` contém apenas código público e a biblioteca comum de componentes. Não contém tokens, credenciais, projetos ou configuração particular. Usa a API do editor diretamente na aba e não inicia uma ponte de rede. Bibliotecas inseridas pelo editor podem ser buscadas pelo próprio EasyEDA.

As ferramentas validam os argumentos em tempo de execução, serializam chamadas e conferem revisão e identidade do documento antes de alterações. Backups são gravados em IndexedDB antes da edição; indisponibilidade do armazenamento impede a alteração. Políticas de PCB ficam no armazenamento local do mesmo navegador. Outros scripts com acesso à origem EasyEDA podem acessar esses dados; não são um cofre.

O agente recebe os dados retornados pelas ferramentas conforme as políticas do cliente. Não abra projetos confidenciais sem avaliar esse acesso. Salve/exporte os documentos antes de encerrar uma sessão cloud: o navegador pode ser temporário. O repositório público não recebe dados em tempo de execução, backups ou downloads. Não publique esses dados em issues ou commits.

Não execute WebMCP e a ponte local na mesma aba. Para desativar WebMCP, recarregue o editor depois de salvar o documento. O código carregado controla a folha ativa: revise a versão do script que estiver instalando.

## Arquivos locais confidenciais

- `data/bridge-token.txt`: credencial da ponte.
- `Conectar-MCP.js` e `extension/main.js`: contêm essa credencial após o setup.
- `config-codex.toml` e `mcp.json`: contêm os caminhos absolutos locais.
- `data/backups/`, `data/exports/` e demais arquivos de `data/`: podem conter projetos completos, políticas, metadados e cópias de configurações locais.

Esses arquivos não devem ser adicionados ao Git, anexados a issues ou incluídos em releases. O setup deve gerar uma credencial diferente em cada instalação.

Se um token local for divulgado, encerre a ponte, remova `data/bridge-token.txt`, rode `npm run setup` novamente e recarregue a extensão/script. Não basta remover o segredo do último commit: revise o histórico e os locais onde ele foi compartilhado.

## Limites da ponte

A ponte usa loopback IPv4, autenticação por token, verificação do Host, lista restrita de origens e ações permitidas. Essas medidas não tornam seguro expor a porta na Internet e não isolam processos que já tenham acesso ao usuário/sistema local. O editor/cliente MCP e o provedor do modelo têm suas próprias políticas de dados.

## Reportar uma vulnerabilidade

Use o canal privado de relato de vulnerabilidade do GitHub, quando estiver habilitado. Se ele não estiver disponível, abra uma issue pedindo um canal privado, sem publicar detalhes de exploração, tokens ou arquivos do usuário. Relatos devem usar uma reprodução sintética sempre que possível.

