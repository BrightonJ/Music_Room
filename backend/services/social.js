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

async function verifyFacebookToken(accessToken) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Facebook credentials are not configured');

  let debug, me;
  try {
    const debugUrl = new URL('https://graph.facebook.com/debug_token');
    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);
    const debugRes = await fetch(debugUrl);
    debug = await debugRes.json();

    if (!debug || !debug.data || !debug.data.is_valid) {
      throw new ClientError('Invalid or expired Facebook token', 401);
    }
    if (String(debug.data.app_id) !== String(appId)) {
      throw new ClientError('Facebook token was issued for another app', 401);
    }

    const meUrl = new URL('https://graph.facebook.com/me');
    meUrl.searchParams.set('fields', 'id,email,first_name,last_name,picture');
    meUrl.searchParams.set('access_token', accessToken);
    const meRes = await fetch(meUrl);
    me = await meRes.json();
  } catch (err) {
    if (err instanceof ClientError) throw err;
    throw new ClientError('Unable to verify Facebook token', 401);
  }

  if (!me || !me.id) throw new ClientError('Unable to read Facebook profile', 401);

  return {
    providerId: me.id,
    email: me.email || null,
    emailVerified: !!me.email,
    firstName: me.first_name || null,
    lastName: me.last_name || null,
    picture: (me.picture && me.picture.data && me.picture.data.url) || null,
  };
}

module.exports = { verifyGoogleToken, verifyFacebookToken };
