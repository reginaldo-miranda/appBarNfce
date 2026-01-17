# 🚀 Configuração e Teste do Sistema de Tablets para Cozinha e Bar

## 📋 Sumário
- [Pré-requisitos](#pré-requisitos)
- [Configuração do Servidor](#configuração-do-servidor)
- [Configuração dos Tablets](#configuração-dos-tablets)
- [Teste do Sistema](#teste-do-sistema)
- [Troubleshooting](#troubleshooting)

## Pré-requisitos

### ✅ Verificações Iniciais
1. **Node.js** instalado (versão 16 ou superior)
2. **Expo Go** instalado no tablet/celular
3. **MySQL** rodando na porta 3306
4. **Rede local** configurada (mesma rede WiFi)

### 🔧 Instalação de Dependências
```bash
# No diretório raiz do projeto
npm install

# No diretório API
cd api
npm install

# No diretório mobile
cd ../mobile
npm install
```

## Configuração do Servidor

### 1️⃣ Configurar Banco de Dados
```bash
cd api
# Executar migrações
npx prisma migrate dev --name init

# Verificar se as tabelas foram criadas
npx prisma studio
```

### 2️⃣ Configurar Variáveis de Ambiente
Crie o arquivo `/api/.env` com:
```env
DATABASE_URL="mysql://root:sua_senha@localhost:3306/barapp"
JWT_SECRET="sua_chave_secreta_super_segura"
PORT=3000
```

### 3️⃣ Iniciar Servidor Backend
```bash
cd api
npm start
```

**✅ Sucesso:** Servidor rodando em `http://localhost:3000`

### 4️⃣ Iniciar Servidor WebSocket (Real-time)
```bash
# Em outro terminal
cd api
node websocket-server.js
```

**✅ Sucesso:** WebSocket rodando na porta 4001

## Configuração dos Tablets

### 📱 Configuração do IP da Rede Local

#### Encontrar IP do Servidor
```bash
# No Mac
ifconfig | grep inet

# No Windows
ipconfig

# No Linux
ip addr show
```

**Exemplo de IP:** `192.168.1.100`

#### Configurar IP no Mobile
1. Edite o arquivo `/mobile/src/services/api.js`
2. Altere a baseURL para seu IP local:
```javascript
const API_BASE_URL = 'http://192.168.1.100:3000'; // Substitua pelo seu IP
```

### 📲 Iniciar Aplicação Mobile
```bash
cd mobile
npx expo start --host lan
```

**⚠️ Importante:** Use `--host lan` para Expo Go, nunca `localhost`

### 🎯 Escolher Setor no Tablet

#### Tablet da Cozinha
1. Abra o app no tablet
2. Vá para **Menu → Tablet Cozinha**
3. O sistema automaticamente detectará o setor "Cozinha"

#### Tablet do Bar
1. Abra o app no tablet
2. Vá para **Menu → Tablet Bar**
3. O sistema automaticamente detectará o setor "Bar"

## Teste do Sistema

### 🧪 Teste 1: Criar Pedido
1. **No desktop/admin:** Crie uma nova venda
2. Adicione produtos com setor "Cozinha" e "Bar"
3. **Verifique:** Os itens aparecem nos tablets correspondentes?

### 🧪 Teste 2: Marcar como Pronto
1. **No tablet:** Toque em "Pronto" em um item
2. **Verifique:** O item desaparece da lista?
3. **Verifique:** Todos os tablets sincronizam?

### 🧪 Teste 3: Impressão
1. **No tablet:** Toque em "Imprimir"
2. **Verifique:** Abre opção de compartilhamento/impressão?

### 🧪 Teste 4: Sincronização em Tempo Real
1. **Abra:** Tablet Cozinha e Bar simultaneamente
2. **No desktop:** Crie um novo pedido
3. **Verifique:** Aparece instantaneamente em ambos?

## 🎥 Fluxo Completo de Teste

```mermaid
graph TD
    A[Desktop: Criar Venda] --> B{Produto tem setor?}
    B -->|Cozinha| C[Aparece no Tablet Cozinha]
    B -->|Bar| D[Aparece no Tablet Bar]
    C --> E[Tablet: Marcar Pronto]
    D --> F[Tablet: Marcar Pronto]
    E --> G[Item some da lista]
    F --> H[Item some da lista]
    G --> I[Sincroniza em tempo real]
    H --> I
```

## Troubleshooting

### ❌ "Conexão falhou"
- **Verifique:** Tablet e servidor na mesma rede WiFi
- **Verifique:** IP configurado corretamente em `api.js`
- **Teste:** Acesse `http://seu-ip:3000` no navegador do tablet

### ❌ "Setor não encontrado"
- **Verifique:** Cadastre setores em **Configurações → Setores de Impressão**
- **Nomes esperados:** "Cozinha", "Bar", "Bebidas", "Drinks"

### ❌ "Nenhum pedido aparece"
- **Verifique:** Produtos têm setor de impressão configurado?
- **Verifique:** Itens têm status "pendente"?
- **Teste:** Crie nova venda com produtos diferentes

### ❌ WebSocket não conecta
- **Verifique:** Porta 4001 está livre
- **Comando:** `lsof -i :4001` (Mac/Linux)
- **Reinicie:** Servidor WebSocket

### ❌ Expo Go não carrega
- **Limpe cache:** `npx expo start -c`
- **Use LAN:** Sempre `--host lan`, nunca localhost
- **Reinstale:** Expo Go no dispositivo

## 📊 Verificação Final

### ✅ Checklist de Funcionalidades
- [ ] Pedidos aparecem por setor
- [ ] Interface limpa e responsiva
- [ ] Botão "Pronto" funciona
- [ ] Sincronização em tempo real
- [ ] Impressão/compartilhamento
- [ ] Conexão estável
- [ ] Tratamento de erros

### 🎯 Dicas de Uso
- **Tablets:** Use modo paisagem para melhor visualização
- **Atualização:** Puxe para baixo para recarregar
- **Impressão:** Conecte impressora via Bluetooth/WiFi
- **Backup:** Sempre salve antes de marcar como pronto

## 📞 Suporte

Se encontrar problemas:
1. Verifique este guia
2. Confira os logs no console
3. Teste etapa por etapa
4. Reinicie serviços se necessário

**Sucesso!** 🎉 Seu sistema de tablets está pronto para uso!