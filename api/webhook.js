// ===========================
// ファイル: api/webhook.js
// 目的: LINEボットWebhook
// - POSTを受け取り200を返す最小構成を保持
// - 最大7桁の会員IDを受け取りDropboxリンクを返信
// ===========================

import crypto from 'crypto';
import fetch from 'node-fetch';

// ===========================
// 環境変数
// ===========================
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ===========================
// Vercel用サーバーレス設定
// ===========================
export const config = {
  api: {
    bodyParser: true, // JSON受信のため必須
  },
};

// ===========================
// サーバーレス関数本体
// ===========================
export default async function handler(req, res) {
  try {
    // ===========================
    // POST以外は405を返す
    // ===========================
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // ===========================
    // 受信JSON
    // ===========================
    const body = req.body;
    console.log('Received body:', JSON.stringify(body, null, 2));

    // ===========================
    // LINE署名検証
    // ===========================
    const signature = req.headers['x-line-signature'] || '';
    const hash = crypto
      .createHmac('SHA256', LINE_CHANNEL_SECRET)
      .update(JSON.stringify(body))
      .digest('base64');

    if (hash !== signature) {
      console.warn('Invalid signature');
      return res.status(403).send('Invalid signature');
    }

    // ===========================
    // イベント処理（複数イベントに対応）
    // ===========================
    if (body.events && body.events.length > 0) {
      await Promise.all(
        body.events.map(async (event) => {
          // メッセージタイプがテキストのみ処理
          if (event.type === 'message' && event.message.type === 'text') {
            const userMessage = event.message.text.trim();

            // ===========================
            // 会員IDチェック（最大7桁の数字）
            // ===========================
            if (!/^\d{1,7}$/.test(userMessage)) {
              await replyMessage(
                event.replyToken,
                '正しい会員IDを入力してください（最大7桁の数字）'
              );
              return;
            }

            // ===========================
            // Dropboxリンク生成
            // ===========================
            const dropboxBaseUrl = 'https://www.dropbox.com/home/members/';
            const folderUrl = `${dropboxBaseUrl}${userMessage}`;

            // ===========================
            // LINEに返信
            // ===========================
            await replyMessage(
              event.replyToken,
              `こちらが会員ID ${userMessage} のフォルダです：\n${folderUrl}`
            );
          }
        })
      );
    }

    // ===========================
    // 最小構成: LINEに必ず200を返す
    // ===========================
    res.status(200).send('OK');

  } catch (err) {
    console.error('Error handling webhook:', err);
    res.status(500).send('Internal Server Error');
  }
}

// ===========================
// LINEに返信する関数
// ===========================
async function replyMessage(replyToken, text) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
  };
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: 'text', text }],
  });

  await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
}
