---
description: cadastro em massa de produtos
---

Objetivo
Criar uma funcionalidade de cadastro em lote (replicação de produtos) no sistema, permitindo cadastrar vários itens semelhantes a partir de um produto base, com edição individual antes de salvar.

🧠 Requisitos Funcionais

Criar uma tela ou fluxo de Cadastro de Produto Base com os campos:

Nome do produto

Marca

Categoria

Unidade de medida

NCM

Produto ativo/inativo

Incluir um botão “Replicar produto”.

Ao clicar em “Replicar produto”:

Abrir um modal ou nova tela

Perguntar:

Quantidade de itens a gerar (ex: 10)

Após informar a quantidade:

O sistema deve replicar os dados do produto base

Gerar uma lista com N linhas conforme a quantidade informada

Exibir uma tabela editável onde cada linha representa um produto:

Descrição

Valor de venda

Quantidade em estoque

Código interno ou código de barras (editável)

(opcional) custo

Permitir:

Editar qualquer campo individualmente

Copiar e colar valores entre linhas

Excluir uma linha antes de salvar

Botão Salvar todos:

Validar campos obrigatórios

Enviar os dados para o backend em lote

Mostrar mensagem de sucesso ou erro

Nao mexer nas funcionalidades existentes, que estao funcionado corretamente.

Responder sempre em portugues