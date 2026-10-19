# Contribuições

Use issues para descrever problemas e pull requests para propor alterações. Antes de redistribuir o projeto ou trechos dele, confirme a licença com o mantenedor; uma licença de código aberto ainda não foi definida.

1. Crie uma branch para a alteração.
2. Instale dependências com `npm ci`.
3. Rode `npm test`, `npm run test:protocol` e `npm run check:public`.
4. Se mudar a integração com o editor, rode `npm run setup` e valide a extensão em um documento descartável no EasyEDA Standard.
5. Descreva a versão do editor, o comportamento anterior/novo e as verificações realizadas no PR.

Não inclua `data/`, `Conectar-MCP.js`, `extension/main.js`, arquivos de configuração locais, tokens, capturas de projetos privados ou exportações de circuitos de terceiros. O `.gitignore` já cobre os arquivos gerados usuais. Prefira casos mínimos sintéticos em `test/`.

Os testes da API simulada não substituem testes no editor. Preserve a identificação dos pads, números de pino e redes, a verificação de revisão/aba e os backups antes de alterações. Não afirme que a conferência geométrica é o DRC nativo do EasyEDA.

Relatos de segurança não devem incluir credenciais nem documentos reais em issues públicas. Consulte [SECURITY.md](SECURITY.md).

