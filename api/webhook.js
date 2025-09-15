// ===========================
// ファイル: api/webhook.js
// LINE Bot + Dropbox連携（Verify対応版）
// ===========================

import { Client, middleware } from '@line/bot-sdk';
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
  api: {
    bodyParser: false, // LINE公式SDK middlewareで処理する
  },
};

// LINE Verify対応 + Dropbox返信
export default async function handler(req, res) {
  try {
    // LINE Verify用のGETリクエストでも200を返す
    if (req.method === 'GET') {
      return res.status(200).send('OK');
    }

    // POSTのみ処理
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // ===========================
    // LINE公式SDKのmiddlewareで署名検証
    // ===========================
    let chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);
    const signature = req.headers['x-line-signature'];

    try {
      middleware({ channelSecret: LINE_CHANNEL_SECRET })(req, res, () => {});
    } catch (err) {
      console.error('署名検証エラー:', err);
      return res.status(200).send('OK'); // Verify用でも200
    }

    const body = JSON.parse(rawBody.toString('utf8'));
    console.log('Received body:', JSON.stringify(body, null, 2));

    // ===========================
    // メッセージイベント処理
    // ===========================
    if (body.events && body.events.length > 0) {
      await Promise.all(
        body.events.map(async (event) => {
          if (event.type === 'message' && event.message.type === 'text') {
            const userMessage = event.message.text.trim();

            // 会員IDチェック（最大7桁）
            if (!/^\d{1,7}$/.test(userMessage)) {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: '正しい会員IDを入力してください（最大7桁の数字）',
              });
              return;
            }

            // Dropboxフォルダ確認
            const folderPath = `/members/${userMessage}`;
            let folderUrl = `https://www.dropbox.com/home${folderPath}`;

            try {
              await dbx.filesGetMetadata({ path: folderPath });
            } catch (err) {
              console.warn(`Folder not found for member ${userMessage}`);
              folderUrl = `会員ID ${userMessage} のフォルダは存在しません`;
            }

            // LINEに返信
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `こちらが会員ID ${userMessage} のフォルダです：\n${folderUrl}`,
            });
          }
        })
      );
    }

    // 最小構成: 必ず200
    res.status(200).send('OK');

  } catch (err) {
    console.error('Webhook処理エラー:', err);
    res.status(200).send('OK'); // Verifyでも200を返す
  }
}
