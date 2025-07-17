# WhatsApp Sticker Bot

Bot de WhatsApp para criar figurinhas a partir de imagens, GIFs e vídeos enviados para o número conectado.

## Funcionalidades
- Crie figurinhas a partir de imagens, GIFs ou vídeos enviados no WhatsApp.
- Suporte a stickers animados (GIFs e vídeos curtos).
- Opção de pedir confirmação antes de transformar a mídia em figurinha.

## Pré-requisitos
- Node.js 18+
- Uma conta de WhatsApp

## Instalação

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repositorio>
   cd whatsapp-bot
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure o bot:**
   Edite o arquivo `config.json` conforme necessário:
   ```json
   {
     "askBeforeTransforming": false,
     "maxDuration": 15,
     "stickerSize": 512
   }
   ```
   - `askBeforeTransforming`: Se `true`, o bot pedirá confirmação antes de criar a figurinha.
   - `maxDuration`: Duração máxima (em segundos) para vídeos/GIFs convertidos.
   - `stickerSize`: Tamanho da figurinha (padrão 512).

4. **Compile o projeto:**
   ```bash
   npm run build
   ```

5. **Inicie o bot:**
   ```bash
   npm start
   ```
   Ou, para desenvolvimento (hot reload):
   ```bash
   npm run dev
   ```

## Como usar
- Envie uma imagem, GIF ou vídeo para o número conectado ao bot.
- Se `askBeforeTransforming` for `true`, responda "sim" para criar a figurinha ou "não" para cancelar.
- O bot irá responder com a figurinha correspondente.

## Observações
- O primeiro uso irá exibir um QR Code no terminal. Escaneie com o WhatsApp para autenticar.
- As credenciais ficam salvas na pasta `auth/`.
- O bot utiliza as bibliotecas [Baileys](https://github.com/WhiskeySockets/Baileys), [sharp](https://sharp.pixelplumbing.com/) e [ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static).

## Licença
MIT 