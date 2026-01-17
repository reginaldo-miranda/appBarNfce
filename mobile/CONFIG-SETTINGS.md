# Configurações de API e WiFi

Esta tela permite configurar a URL da API, uma chave de autenticação opcional e armazenar credenciais de WiFi.

## Onde acessar
- Tela inicial → ícone de engrenagem (Configurações) no canto superior direito.

## Seção API
- URL da API: obrigatório, deve começar com `http://` ou `https://` e incluir o sufixo `/api` do backend.
- Chave de autenticação: opcional; quando fornecida, é enviada no cabeçalho `X-API-Key` em todas as requisições.
- Testar Conexão: verifica acesso realizando `GET /tipo/list` na URL informada.

### Armazenamento
- `API_BASE_URL`: `AsyncStorage` (não sensível).
- `API_AUTH_KEY`: armazenado com `Expo SecureStore` (com fallback para `AsyncStorage` em ambientes sem suporte).

## Seção WiFi
- Redes disponíveis (SSID): listagem mockada em ambientes sem suporte nativo. Pode ser integrada a bibliotecas nativas como `react-native-wifi-reborn`.
- Senha: armazenada com `Expo SecureStore` (com fallback para `AsyncStorage`).
- Salvar Configurações: salva SSID e senha de forma segura (a conexão é simulada no mock atual).

## Feedback e validação
- Campos obrigatórios são validados antes de enviar.
- Status da conexão é exibido com cores (verde/vermelho) e ícones.
- Erros de conexão/teste exibem mensagens claras.

## Testes realizados
1. URLs válidas e inválidas de API
   - Válidas: `http://localhost:4000/api`, `http://<IP_LOCAL>:4000/api` → sucesso/erro conforme backend.
   - Inválidas: `semProtocolo`, `ftp://...` → bloqueadas por validação local.
2. Persistência após reinício
   - Reiniciando o app Web/Expo, a URL e a chave permanecem preenchidas.
   - SSID e senha do WiFi reaparecem nos campos ao reabrir a tela.
3. Fluxos de WiFi
   - Listagem de redes: exibe redes mockadas.
   - Salvar WiFi: exige SSID e senha; salva com sucesso e confirma via alerta.

## Observações
- Conexão WiFi real exige integração nativa e permissões do SO; o módulo atual é um mock seguro para UI/estado.
- Caso seu backend use outro cabeçalho de autenticação, ajuste o interceptor em `src/services/api.js`.