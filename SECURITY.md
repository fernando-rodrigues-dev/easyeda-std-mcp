# Segurança e privacidade

Este software controla o documento aberto no EasyEDA. Use um cliente MCP confiável e confira alterações antes de fabricar uma placa.

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

