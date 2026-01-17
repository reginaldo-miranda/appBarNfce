# Guia de Build com EAS (iOS e Android)

Este guia descreve como gerar builds nativos usando EAS para testar Wi‑Fi real no Android e conectar SSID específico no iOS.

## Pré-requisitos
- Conta Expo (faça login: `npx expo login`).
- App já configurado com `expo-dev-client` e `eas.json` (ok neste projeto).
- Para iOS: conta Apple Developer ativa (necessária para assinar build). Em Windows, use EAS Build na nuvem.
- Para Android: pode gerar APK interno para instalar no dispositivo.

## Perfis de build
- `development`: inclui o Development Client (abre via QR/URL do Metro, ideal para testes).
- `preview`: build interno para distribuição sem o dev client.
- `production`: build para loja.

## Android (development build)
1. Conecte um dispositivo Android físico (Depuração USB ligada) ou prepare para instalar APK manualmente.
2. Execute:
   ```bash
   npx eas build -p android --profile development
   ```
3. Ao finalizar, baixe o APK e instale no dispositivo.
4. Inicie o Metro:
   ```bash
   npx expo start --port 8083
   ```
5. Abra o app (development build) no Android e conecte ao Metro (QR/Deep Link). Teste Configurações > Buscar Redes.

## iOS (development build)
1. Garanta que você tem uma Apple ID com acesso ao Apple Developer Program.
2. Execute:
   ```bash
   npx eas build -p ios --profile development
   ```
   - O EAS pedirá/criará credenciais de assinatura (certificado, perfil de provisionamento). Siga as instruções no terminal.
3. Ao finalizar, instale o build no iPhone (via link do EAS ou TestFlight interno).
4. Inicie o Metro:
   ```bash
   npx expo start --port 8083
   ```
5. Abra o app (development build) no iPhone, conecte ao Metro. Em Configurações, digite SSID e senha e toque em “Salvar WiFi”.

## Observações importantes
- Web/Expo Go: não listam redes Wi‑Fi reais. Use SSID manual.
- Android: para listar redes, ative a Localização do sistema e aceite permissões ao buscar redes.
- iOS: não existe API pública para listar redes. É possível apenas tentar conectar a um SSID informado (via NEHotspotConfiguration). O sistema pode pedir confirmação.
- Em redes com captive portal, pode surgir uma tela do sistema para autenticação.

## Comandos úteis
```bash
# Configurar projeto para EAS (se necessário)
npx eas build:configure

# Build development Android
echo "Android dev build" && npx eas build -p android --profile development

# Build development iOS
echo "iOS dev build" && npx eas build -p ios --profile development

# Iniciar servidor (Metro)
npx expo start --port 8083
```