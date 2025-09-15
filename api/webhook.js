// ===========================
// ファイル: api/webhook.js
// 目的: LINEボットWebhook（Dropbox連携版）
// ===========================

import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

// Vercelサーバーレス設定
export const config = {
  api: {
    bodyParser: true,
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

// Dropboxクライアント
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN, fetch });

// ===========================
// Webhook本体
// ===========================
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const body = req.body;
    console.log('Received body:', JSON.stringify(body, null, 2));

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

            // ===========================
            // Dropboxフォルダ存在確認
            // ===========================
            const folderPath = `/members/${userMessage}`; // App Folder内
            let folderUrl = `https://www.dropbox.com/home${folderPath}`; // デフォルトURL

            try {
              const metadata = await dbx.filesGetMetadata({ path: folderPath });
              if (metadata) {
                folderUrl = `https://www.dropbox.com/home${folderPath}`;
              }
            } catch (err) {
              console.warn(`Folder not found for member ${userMessage}`);
              folderUrl = `会員ID ${userMessage} のフォルダは存在しません`;
            }

            // LINEに返信
            await replyMessage(
              event.replyToken,
              `こちらが会員ID ${userMessage} のフォルダです：\n${folderUrl}`
            );
          }
        })
      );
    }

    // 最小構成: 必ず200を返す
    res.status(200).send('OK');

  } catch (err) {
    console.error('Error handling webhook:', err);
    res.status(500).send('Internal Server Error');
  }
}
