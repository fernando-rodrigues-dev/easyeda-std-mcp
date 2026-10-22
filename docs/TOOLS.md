# Ferramentas MCP

## Gerais e de esquema

`easyeda_status`, `easyeda_read_schematic`, `easyeda_get_source`, `easyeda_get_shape`, `easyeda_search_components`, `easyeda_new_schematic`, `easyeda_add_component`, `easyeda_set_component`, `easyeda_add_wire`, `easyeda_connect_pins`, `easyeda_add_net_label`, `easyeda_add_power`, `easyeda_add_junction`, `easyeda_add_text`, `easyeda_move_objects`, `easyeda_rotate_objects`, `easyeda_delete_objects`, `easyeda_apply_source`, `easyeda_export_schematic`.

Comece por status e leitura. Use os pontos de conexão retornados pelos pinos e a revisão mais recente. Fios são ortogonais e não evitam obstáculos automaticamente. Símbolos específicos exigem UUID do Standard.

## PCB

| Ferramenta | Finalidade |
|---|---|
| `easyeda_read_pcb` | Ler componentes, pads, redes, coordenadas e revisão. |
| `easyeda_pcb_duplicate_active` | Abrir uma cópia em outra aba; experimental. |
| `easyeda_pcb_place_components` | Posicionar/girar footprints existentes. |
| `easyeda_pcb_set_component_side` | Espelhar footprint e camadas; experimental. |
| `easyeda_pcb_add_track` | Criar trilha de uma rede existente. |
| `easyeda_pcb_connect_pads` | Criar rota simples entre pads da mesma rede. |
| `easyeda_pcb_set_outline` | Criar/substituir contorno. |
| `easyeda_pcb_add_hole` | Criar furo mecânico não metalizado. |
| `easyeda_pcb_add_text` | Criar anotação. |
| `easyeda_pcb_set_single_sided` | Restringir o cobre à face inferior. |
| `easyeda_pcb_apply_source` | Aplicar layout preservando identidade dos pads; experimental. |
| `easyeda_pcb_delete_objects` | Remover objetos auxiliares; não remove footprints/pads. |
| `easyeda_pcb_check_layout` | Conferir trilhas e continuidade, com limitações. |
| `easyeda_export_pcb` | Gravar uma cópia JSON local reabrível. |

PCB usa mm relativos à origem. Mover uma peça não redesenha trilhas conectadas. Nos pads de número repetido, informe o ID físico. Veja [as limitações de reaplicação de fonte e da conferência](LIMITATIONS.md) antes de editar.


## Novos documentos e biblioteca PCB

- `easyeda_open_document`: fonte STD em uma nova aba, com cópia e confirmação de componentes/pads.
- `easyeda_new_pcb`: PCB vazia em uma nova aba.
- `easyeda_pcb_add_footprint`: biblioteca GeneralPackages ou UUID Standard, coordenadas em mm e revisão obrigatória; preserva a netlist preexistente. `through_hole_only: true` exige pads PTH com furo. Se a biblioteca retornar uma peça incompatível com essa opção ou com a política de face simples, a PCB anterior é restaurada.

Estas operações usam a API oficial: https://docs.easyeda.com/en/API/3-API-List/. Não executam JavaScript arbitrário recebido por parâmetros.
