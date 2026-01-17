---
description: implementacao de nfce
---

Implementação de NFC-e (Cupom Fiscal Eletrônico)

Estudo das regras

Ler e seguir a documentação oficial das regras de NFC-e da SEFAZ (REFaz), garantindo conformidade legal.

Emissão de NFC-e

Implementar a emissão de Cupom Fiscal Eletrônico (NFC-e) no momento da finalização da venda.

Utilizar os dados já existentes no sistema (produtos, valores, impostos, cliente, forma de pagamento etc.).

Geração do XML

Gerar o arquivo XML da NFC-e conforme o layout oficial da SEFAZ.

Criar uma pasta específica no sistema para armazenar todos os XMLs emitidos, conforme exigência legal.

Garantir que os XMLs fiquem organizados por data e número da NFC-e.

Validação e autorização

Enviar o XML para a SEFAZ para validação e autorização.

Tratar corretamente os retornos (autorizado, rejeitado, contingência).

QR Code

Gerar o QR Code da NFC-e conforme o padrão exigido pela SEFAZ.

O QR Code deve conter a URL de consulta pública da nota.

Impressão do cupom

Implementar a impressão do cupom fiscal com todos os dados obrigatórios:

Dados da empresa

Produtos

Valores

Tributos

Chave de acesso

QR Code

Protocolo de autorização da SEFAZ

Geração de PDF

Criar um PDF do cupom fiscal (DANFE NFC-e) para:

Impressão

Download

Envio ao cliente, se necessário

Compatibilidade com o sistema atual

Reutilizar as estruturas e dados já existentes no sistema.

Não alterar nem quebrar as funcionalidades atuais.

Garantir que a nova implementação seja isolada e integrada de forma segura.

responde sempre em portugues