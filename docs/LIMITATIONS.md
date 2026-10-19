# Limitações conhecidas

## Fonte PCB e recuperação

Uma atualização de fonte PCB por `applySource` foi observada descartando pads e a área de cobre no editor. O código detectou a divergência da identidade dos pads, mas a alteração já havia ocorrido. Os backups permitem recuperar o documento, porém não há rollback automático garantido.

As operações que usam a reaplicação de fonte comprimido, incluindo importação de layout e algumas edições de PCB, devem ser tratadas como experimentais. Use uma cópia descartável, exporte antes de editar e compare componentes, pads, redes, furos e áreas depois. Reabrir o arquivo JSON local é o caminho de recuperação. Não teste uma correção em um projeto real sem backup independente.

## Conferência geométrica

`easyeda_pcb_check_layout` faz uma análise conservadora das trilhas contra pads, trilhas, furos e limites aproximados de áreas. Áreas preenchidas não são analisadas com a mesma precisão do DRC nativo e podem gerar falsos positivos. A continuidade de planos de cobre também não é resolvida integralmente.

Não verifica todos os pares de pads, encaixe físico dos componentes, bordas, tolerância da furação, capacidade de corrente, isolamento, dissipação nem normas de fabricação. Não é um roteador automático.

Pontes de fio são conexões físicas a montar. Somente marcações explícitas `MCP_WIRE` podem contabilizá-las; linhas gráficas não representam cobre. O relatório separa continuidade em cobre e continuidade após instalar os fios declarados.

## Compatibilidade

O alvo inicial é o EasyEDA Standard 6.5.51 no Windows. O Pro não é compatível. A versão do editor, a política de conexão local e o formato dos arquivos podem mudar o comportamento. Cada nova versão precisa de validação manual em documentos sintéticos.

Os testes automatizados simulam a API. Passar nesses testes não prova que o editor preservou o documento nem que uma PCB está pronta para fabricação.

