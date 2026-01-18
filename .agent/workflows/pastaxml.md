---
description: criar pastas para xml
---

Na tela de Configuração da NFC-e, adicionar um campo de configuração que permita ao usuário selecionar a pasta base onde serão armazenados os arquivos XML gerados pelas vendas fiscais.

Requisitos da funcionalidade:

Criar um input para seleção de diretório (pasta) no sistema.

A pasta selecionada será usada como diretório base para salvar os XMLs da NFC-e.

O sistema deve criar automaticamente subpastas organizadas por mês e ano, no momento da gravação do XML.

Formato das pastas:

jan2026

fev2026

mar2026

e assim sucessivamente.

Caso a pasta do mês ainda não exista, o sistema deve criá-la automaticamente.

Os arquivos XML devem ser salvos dentro da pasta correspondente ao mês/ano da emissão da nota.

A configuração da pasta deve ser persistida no sistema (banco de dados ou arquivo de configuração) para uso nas próximas emissões.

Essa implementação não deve afetar as funcionalidades já existentes de emissão de NFC-e.

📌 Observação: A organização dos XMLs por mês é exigência legal para facilitar auditoria, backup e fiscalização.