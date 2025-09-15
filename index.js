const express = require('express');
const bodyParser = require('body-parser');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => res.json(result));
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return Promise.resolve(null);

  const memberId = event.message.text.trim(); 
  const dropboxBaseUrl = 'https://www.dropbox.com/home/members/';
  const folderUrl = `${dropboxBaseUrl}${memberId}`;

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `こちらがあなたのフォルダです: ${folderUrl}`
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
