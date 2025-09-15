// ===========================
// ファイル: api/webhook.js
// 目的: LINEボットWebhook（最小構成）
// - POSTを受けて必ず200を返す
// - 最大7桁の会員IDを受け取りDropboxリンクを返信
// ===========================

import fetch from 'node-fetch';

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Vercelサーバーレス設定
export const config = {
  api: {
    bodyParser: true, // JSONを受け取るために必要
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

            // Dropboxリンク生成
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
    // 最小構成: LINEに必ず200を返す
    // ===========================
    res.status(200).send('OK');

  } catch (err) {
    console.error('Error handling webhook:', err);
    res.status(500).send('Internal Server Error');
  }
}
