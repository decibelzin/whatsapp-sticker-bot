import makeWASocket, {
  Browsers,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import qrcode from 'qrcode-terminal';
import { spawn } from 'child_process';
import ffmpeg from 'ffmpeg-static';

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const lastMedia = new Map<string, { msg: any, type: 'image' | 'gif' | 'video' }>();

async function convertToAnimatedWebP(inputPath: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpegProcess = spawn(ffmpeg!, [
      '-i', inputPath,
      '-t', config.maxDuration.toString(),
      '-vcodec', 'libwebp',
      '-vf', `scale=${config.stickerSize}:${config.stickerSize}:force_original_aspect_ratio=increase,crop=${config.stickerSize}:${config.stickerSize}`,
      '-loop', '0',
      '-an',
      '-vsync', '0',
      outputPath
    ]);
    ffmpegProcess.on('close', (code) => {
      resolve(code === 0);
    });
    ffmpegProcess.on('error', () => {
      resolve(false);
    });
  });
}

async function processMedia(sock: any, userId: string, msg: any, mediaType: 'image' | 'gif' | 'video') {
  try {
    if (mediaType === 'image') {
      const mediaMsg = { key: msg.key, message: { imageMessage: msg.message.imageMessage } };
      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
      if (!buffer) {
        await sock.sendMessage(userId, { text: '❌ Não consegui baixar a mídia.' }, { quoted: msg });
        return;
      }
      const tempPath = path.join(__dirname, 'temp_media');
      if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
      const inputFileName = path.join(tempPath, `${Date.now()}.jpg`);
      fs.writeFileSync(inputFileName, buffer);
      const stickerBuffer = await sharp(inputFileName).resize(config.stickerSize, config.stickerSize, { fit: 'inside' }).webp().toBuffer();
      await sock.sendMessage(userId, { sticker: stickerBuffer }, { quoted: msg });
      fs.unlinkSync(inputFileName);
    } else {
      const mediaMsg = { key: msg.key, message: { videoMessage: msg.message.videoMessage } };
      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
      if (!buffer) {
        await sock.sendMessage(userId, { text: '❌ Não consegui baixar a mídia.' }, { quoted: msg });
        return;
      }
      const tempPath = path.join(__dirname, 'temp_media');
      if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
      const inputFileName = path.join(tempPath, `${Date.now()}.mp4`);
      fs.writeFileSync(inputFileName, buffer);
      const outputFileName = path.join(tempPath, `${Date.now()}_sticker.webp`);
      const success = await convertToAnimatedWebP(inputFileName, outputFileName);
      if (success && fs.existsSync(outputFileName)) {
        const stickerBuffer = fs.readFileSync(outputFileName);
        await sock.sendMessage(userId, { sticker: stickerBuffer }, { quoted: msg });
        fs.unlinkSync(outputFileName);
      } else {
        await sock.sendMessage(userId, { text: '❌ Erro ao converter para figurinha animada.' }, { quoted: msg });
      }
      fs.unlinkSync(inputFileName);
    }
  } catch (error) {
    console.error('Erro ao processar figurinha:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao criar figurinha. Tente novamente.' }, { quoted: msg });
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.windows('Chrome'),
    printQRInTerminal: true,
    generateHighQualityLinkPreview: true
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== 401;
      if (shouldReconnect) startBot();
    }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const userId = msg.key.remoteJid!;
    if (msg.message.imageMessage) {
      if (config.askBeforeTransforming) {
        lastMedia.set(userId, { msg, type: 'image' });
        await sock.sendMessage(userId, {
          text: 'Deseja criar uma figurinha dessa imagem?\n\nDigite *sim* para criar ou *não* para cancelar.'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(userId, { text: '⏳ Criando sua figurinha, aguarde...' }, { quoted: msg });
        await processMedia(sock, userId, msg, 'image');
      }
      return;
    }
    if (msg.message.videoMessage && msg.message.videoMessage.gifPlayback) {
      if (config.askBeforeTransforming) {
        lastMedia.set(userId, { msg, type: 'gif' });
        await sock.sendMessage(userId, {
          text: 'Deseja criar uma figurinha animada desse GIF?\n\nDigite *sim* para criar ou *não* para cancelar.'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(userId, { text: '⏳ Criando sua figurinha animada, aguarde...' }, { quoted: msg });
        await processMedia(sock, userId, msg, 'gif');
      }
      return;
    }
    if (msg.message.videoMessage && !msg.message.videoMessage.gifPlayback) {
      if (config.askBeforeTransforming) {
        lastMedia.set(userId, { msg, type: 'video' });
        await sock.sendMessage(userId, {
          text: 'Deseja transformar este vídeo em um GIF?\n\nDigite *sim* para criar ou *não* para cancelar.'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(userId, { text: '⏳ Criando sua figurinha animada, aguarde...' }, { quoted: msg });
        await processMedia(sock, userId, msg, 'video');
      }
      return;
    }
    if (config.askBeforeTransforming) {
      const text = msg.message.conversation?.toLowerCase() ||
                   msg.message.extendedTextMessage?.text?.toLowerCase() || '';
      if (text === 'sim') {
        const last = lastMedia.get(userId);
        if (!last) {
          await sock.sendMessage(userId, { text: '❌ Nenhuma mídia encontrada. Envie uma imagem, GIF ou vídeo primeiro.' }, { quoted: msg });
          return;
        }
        await sock.sendMessage(userId, { text: '⏳ Criando sua figurinha, aguarde...' }, { quoted: msg });
        await processMedia(sock, userId, last.msg, last.type);
        lastMedia.delete(userId);
      } else if (text === 'não' || text === 'nao') {
        lastMedia.delete(userId);
        await sock.sendMessage(userId, { text: '✅ Ok! Operação cancelada.' }, { quoted: msg });
      }
    }
  });
}

startBot(); 