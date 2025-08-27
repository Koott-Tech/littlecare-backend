const { google } = require('googleapis');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const TOKENS_PATH = path.join(__dirname, '../tokens.json');

function getOAuth2Client() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  if (existsSync(TOKENS_PATH)) {
    try {
      const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
      oAuth2Client.setCredentials(tokens);
    } catch (error) {
      console.log('⚠️ Error reading tokens file:', error.message);
    }
  }
  
  oAuth2Client.on('tokens', (tokens) => {
    try {
      const prev = existsSync(TOKENS_PATH) ? JSON.parse(readFileSync(TOKENS_PATH, 'utf8')) : {};
      const newTokens = { ...prev, ...tokens };
      writeFileSync(TOKENS_PATH, JSON.stringify(newTokens, null, 2));
      console.log('✅ Tokens updated and saved');
    } catch (error) {
      console.error('❌ Error saving tokens:', error.message);
    }
  });
  
  return oAuth2Client;
}

function calendar() {
  return google.calendar({ version: 'v3', auth: getOAuth2Client() });
}

function authUrl() {
  const oauth2 = getOAuth2Client();
  const scopes = (process.env.GOOGLE_SCOPES || '').split(' ').filter(Boolean);
  
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

async function exchangeCode(code) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  // tokens persist via the 'tokens' event handler
  return tokens;
}

module.exports = {
  getOAuth2Client,
  calendar,
  authUrl,
  exchangeCode
};
