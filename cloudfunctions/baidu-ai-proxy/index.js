const cloud = require('wx-server-sdk');
const https = require('https');
const querystring = require('querystring');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// IMPORTANT: Keys are stored server-side, not in client code.
// Provided by user for this project.
const API_KEY = 'rJtyOhhpWmzpCtkqe2RBSuY6';
const SECRET_KEY = 'o9jMcF3qbM5wlpsWxFfDFplFIfu9RITy';

let cachedToken = null;
let tokenExpiresAt = 0;

function httpPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'string' ? data : querystring.stringify(data || {});
    const u = new URL(url);
    const options = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };
    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (d) => { chunks += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(chunks);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: chunks });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let chunks = '';
        res.on('data', (d) => (chunks += d));
        res.on('end', () => {
          try {
            const json = JSON.parse(chunks);
            resolve({ statusCode: res.statusCode, data: json });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: chunks });
          }
        });
      })
      .on('error', reject);
  });
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`;
  const res = await httpGet(url);
  if (res.statusCode === 200 && res.data && res.data.access_token) {
    cachedToken = res.data.access_token;
    const expiresIn = Number(res.data.expires_in || 0) * 1000; // seconds -> ms
    tokenExpiresAt = Date.now() + Math.max(expiresIn - 300000, 3600000); // minus 5m buffer, min 1h
    return cachedToken;
  }
  const msg = (res.data && (res.data.error_description || res.data.error)) || 'unknown_error';
  throw new Error(`token_failed: ${msg}`);
}

async function recognize(imageBase64, baikeNum = 1) {
  const token = await getAccessToken();
  const url = `https://aip.baidubce.com/rest/2.0/image-classify/v1/plant?access_token=${token}`;
  const res = await httpPost(url, { image: imageBase64, baike_num: baikeNum });
  if (res.statusCode === 200 && res.data && Array.isArray(res.data.result)) {
    return res.data.result;
  }
  const msg = (res.data && (res.data.error_msg || res.data.error)) || 'recognition_failed';
  const err = new Error(msg);
  err.response = res.data;
  throw err;
}

exports.main = async (event, context) => {
  const { action, imageBase64 = '', baike_num = 1, fileID = null } = event || {};
  try {
    if (action === 'ping') {
      return { ok: true };
    }
    if (action === 'token') {
      const t = await getAccessToken();
      return { ok: true, access_token: t };
    }
    if (action === 'recognize') {
      if (!imageBase64) return { ok: false, error: 'missing_image' };
      const result = await recognize(imageBase64, baike_num);
      return { ok: true, result };
    }
    if (action === 'recognizeByFileID') {
      if (!fileID) return { ok: false, error: 'missing_fileID' };
      const res = await cloud.downloadFile({ fileID });
      if (!res || !res.fileContent) return { ok: false, error: 'download_failed' };
      const b64 = Buffer.from(res.fileContent).toString('base64');
      const result = await recognize(b64, baike_num);
      return { ok: true, result };
    }
    return { ok: false, error: 'unknown_action' };
  } catch (e) {
    return { ok: false, error: e.message || 'error' };
  }
};
