import crypto from 'crypto';
import fetch from 'node-fetch';

// 環境変数
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Vercel用設定: bodyParser falseにして生データを取得
export const config = {
  api: {
    bodyParser: false,
  },
};

// LINEに返信する関数
async function replyMessage(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // ===========================
    // 生のリクエストボディを取得
    // ===========================
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);
    const signature = req.headers['x-line-signature'];

    // ===========================
    // 署名検証
    // ===========================
    const hash = crypto
      .createHmac('SHA256', LINE_CHANNEL_SECRET)
      .update(rawBody)
      .digest('base64');

    if (hash !== signature) {
      console.warn('Invalid signature');
      return res.status(403).send('Invalid signature');
    }

    // ===========================
    // JSONに変換
    // ===========================
    const body = JSON.parse(rawBody.toString('utf8'));
    console.log('Received body:', JSON.stringify(body, null, 2));

    // ===========================
    // イベント処理
    // ===========================
    if (body.events && body.events.length > 0) {
      await Promise.all(
        body.events.map(async (event) => {
          if (event.type === 'message' && event.message.type === 'text') {
            const userMessage = event.message.text.trim();

            // 会員IDチェック（最大7桁）
            if (!/^\d{1,7}$/.test(userMessage)) {
              await replyMessage(
                event.replyToken,
                '正しい会員IDを入力してください（最大7桁の数字）'
              );
              return;
            }

            const dropboxBaseUrl = 'https://www.dropbox.com/home/members/';
            const folderUrl = `${dropboxBaseUrl}${userMessage}`;
            await replyMessage(
              event.replyToken,
              `こちらが会員ID ${userMessage} のフォルダです：\n${folderUrl}`
            );
          }
        })
      );
    }

    // ===========================
    // 最小構成: 必ず200を返す
    // ===========================
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling webhook:', err);
    res.status(500).send('Internal Server Error');
  }
}
