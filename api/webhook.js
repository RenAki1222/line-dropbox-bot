// ===========================
// LINE Bot + Dropbox連携（安全版）
// Vercel用
// ===========================

import { Client } from '@line/bot-sdk';
import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

// LINE SDKクライアント
const client = new Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
});

// Dropboxクライアント
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN, fetch });

// Vercelサーバーレス設定
export const config = {
  api: { bodyParser: true },
};

// LINEに返信する関数（安全版）
async function safeReply(replyToken, text) {
  try {
    await client.replyMessage(replyToken, {
      type: 'text',
      text,
    });
  } catch (err) {
    console.error('replyMessageエラー:', err);
  }
}

// ===========================
// Webhook本体
// ===========================
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // LINE Verify用 GETリクエストは200を返す
      return res.status(200).send('OK');
    }

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
              await safeReply(event.replyToken, '正しい会員IDを入力してください（最大7桁の数字）');
              return;
            }

            // Dropboxフォルダ確認
            const folderPath = `/members/${userMessage}`;
            let folderUrl = `https://www.dropbox.com/home${folderPath}`;

            try {
              await dbx.filesGetMetadata({ path: folderPath });
            } catch (err) {
              console.warn(`Folder not found for member ${userMessage}:`, err);
              folderUrl = `会員ID ${userMessage} のフォルダは存在しません`;
            }

            // LINEに返信
            await safeReply(event.replyToken, `こちらが会員ID ${userMessage} のフォルダです：\n${folderUrl}`);
          }
        })
      );
    }

    // 最小構成: 必ず200を返す
    res.status(200).send('OK');

  } catch (err) {
    console.error('Webhook処理エラー:', err);
    // 例外が起きても200を返してLINE側のエラーを防ぐ
    res.status(200).send('OK');
  }
}
