const { OAuth2Client } = require('google-auth-library');
const { ClientError } = require('../utils/errors');

let googleClient = null;
function getGoogleClient() {
  if (!googleClient) {
    const id = process.env.GOOGLE_CLIENT_ID;
    if (!id) throw new Error('GOOGLE_CLIENT_ID is not configured');
    googleClient = new OAuth2Client(id);
  }
  return googleClient;
}

async function verifyGoogleToken(idToken) {
  let ticket;
  try {
    const client = getGoogleClient();
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    throw new ClientError('Invalid or expired Google token', 401);
  }
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) throw new ClientError('Invalid Google token payload', 401);
  return {
    providerId: payload.sub,
    email: payload.email || null,
    emailVerified: !!payload.email_verified,
    firstName: payload.given_name || null,
    lastName: payload.family_name || null,
    picture: payload.picture || null,
  };
}

module.exports = { verifyGoogleToken };
