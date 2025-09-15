import { json } from 'micro';
import crypto from 'crypto';
import fetch from 'node-fetch';

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = await json(req);
  const signature = req.headers['x-line-signature'];

  // 署名チェック
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(JSON.stringify(body))
    .digest('base64');

  if (hash !== signature) {
    return res.status(403).send('Invalid signature');
  }

  try {
    const event = body.events[0];
    const userMessage = event.message.text;

    // 会員IDが7桁以内かチェック
    const memberId = userMessage.trim();
    if (!/^\d{1,7}$/.test(memberId)) {
      await replyMessage(event.replyToken, '正しい会員IDを入力してください（最大7桁の数字）');
      return res.status(200).send('OK');
    }

    // DropboxフォルダURLを生成（例）
    const dropboxBaseUrl = 'https://www.dropbox.com/home/members/';
    const folderUrl = `${dropboxBaseUrl}${memberId}`;

    await replyMessage(event.replyToken, `こちらが会員ID ${memberId} のフォルダです：\n${folderUrl}`);
    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
}

// LINEに返信する関数
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
