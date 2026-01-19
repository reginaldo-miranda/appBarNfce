---
description: refatorar o sistema de delivery
---

Objetivo: Refatorar e aprimorar o fluxo de delivery utilizando as funcionalidades já existentes no sistema, sem impactar os módulos que já estão funcionando corretamente.

Fluxo do processo:

O usuário abre uma venda balcão.

Realiza o lançamento dos produtos normalmente.

O sistema deve buscar ou solicitar os dados do cliente, incluindo: mas na seguinte ordem

CEP

Endereço completo (incluir usando os dados do cep), caso nao tenha o cep digitar manual mente o endereco. para ja ir calculando o valor da entrega.

Nome

Telefone



Forma de pagamento (dinheiro, cartão, PIX, etc.)

O sistema deve calcular o valor da entrega com base na distância:

Utilizar a API do Google Maps para cálculo de distância.

Aplicar uma tabela de valores por faixa de distância.

Exibir ao usuário:

Valor total dos produtos

Valor da entrega

Valor final da venda

Caso o cliente concorde com os valores:

Enviar os produtos para os setores correspondentes (ex.: bar, cozinha, chapa).

Imprimir um cupom não fiscal para separação e entrega.

Caso o cliente solicite cupom fiscal:

Emitir o cupom fiscal considerando a forma de pagamento informada.

Caso não solicite, o sistema deve seguir o fluxo normalmente, sem emissão fiscal.

Registrar a venda na tela de Delivery, com status inicial:

Aguardando liberação dos setores

Após todos os setores liberarem os pedidos:

Alterar automaticamente o status para Em rota / Entrega.

Quando o entregador retornar:

Na tela de delivery, clicar em Finalizar venda.

Se o cupom fiscal já tiver sido emitido, não emitir novamente.

Se não tiver sido emitido, permitir ao proprietário escolher se deseja emitir ou não.

Realizar os demais lançamentos necessários (financeiro, relatórios, fechamento, etc.).

Observações importantes:

O sistema já possui diversas funcionalidades prontas para delivery.

Utilizar e reaproveitar o que já existe, conforme necessário.

Não alterar funcionalidades existentes que estejam estáveis e funcionando corretamente.

🛠️ Plano de Execução
Fase 1 – Análise

Mapear o fluxo atual do delivery.

Identificar quais funcionalidades já existem e podem ser reutilizadas.

Levantar pontos de integração com:

Cadastro de clientes

Venda balcão

Setores (bar, cozinha, chapa)

Emissão de cupom fiscal e não fiscal

Fase 2 – Ajustes no Fluxo de Venda

Integrar a venda balcão com o fluxo de delivery.

Garantir captura e validação dos dados do cliente.

Ajustar a seleção e validação da forma de pagamento.

Fase 3 – Cálculo de Entrega

Implementar integração com Google Maps (Distance Matrix).

Criar tabela de valores por distância.

Automatizar o cálculo e exibição do valor da entrega.

Fase 4 – Impressões

Ajustar impressão do cupom não fiscal para delivery.

Controlar a emissão do cupom fiscal conforme solicitação do cliente.

Evitar emissão duplicada.

Fase 5 – Tela de Delivery

Ajustar status da entrega:

Aguardando liberação

Em entrega

Finalizada

Integrar liberação automática pelos setores.

Criar ação de finalização pelo entregador/proprietário.

Fase 6 – Testes e Validação

Testar fluxo completo:

Com e sem cupom fiscal

Diferentes formas de pagamento

Diferentes distâncias

Validar que funcionalidades existentes não foram afetadas.

Fase 7 – Entrega Final

Revisão de código

Testes finais em ambiente real

Documentação do fluxo para uso e manutenção