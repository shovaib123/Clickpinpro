// api/r2-upload.js
// ✅ Ye ek Vercel serverless function hai — YE SERVER PE CHALTA HAI, browser mein NAHI.
// R2 ki Secret Access Key sirf Vercel Environment Variables mein rehti hai,
// isliye koi bhi "View Source" karke isko chura nahi sakta.
//
// Zaroori Vercel Environment Variables (Vercel Dashboard → Project → Settings → Environment Variables):
//   R2_ACCOUNT_ID       = 354cd3c649861324f0f24887b805bb1b   (aapke screenshot ke endpoint se)
//   R2_ACCESS_KEY_ID    = 6a769826142c4403eb15eae1d436c815
//   R2_SECRET_ACCESS_KEY= 86a90bb0b0eb7bf01bc2930464115b84c345848b4e327d73b7003f717734c4ac
//   R2_BUCKET_NAME      = showfy
//   R2_PUBLIC_URL       = https://pub-1493b1ed9b9f441aba74e06e58228c5e.r2.dev

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const config = {
  api: {
    bodyParser: false, // file ko raw binary stream ki tarah lenge (fast + simple)
  },
};

let s3Client = null;
function getClient() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeExtFromNameOrType(filename, contentType) {
  const fromName = (filename || '').split('.').pop();
  if (fromName && fromName.length <= 5 && /^[a-zA-Z0-9]+$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = (contentType || '').split('/').pop();
  return (fromType || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
}

export default async function handler(req, res) {
  // Simple CORS (same-origin use case, but harmless to allow)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed, use PUT' });
    return;
  }

  try {
    const requiredEnv = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'];
    const missing = requiredEnv.filter((k) => !process.env[k]);
    if (missing.length) {
      res.status(500).json({ error: 'Server not configured. Missing env vars: ' + missing.join(', ') });
      return;
    }

    const filename = typeof req.query.filename === 'string' ? req.query.filename : 'file';
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const ext = safeExtFromNameOrType(filename, contentType);

    const body = await readRawBody(req);
    if (!body || body.length === 0) {
      res.status(400).json({ error: 'Empty file body' });
      return;
    }
    // 200MB safety cap (adjust as needed)
    const MAX_BYTES = 200 * 1024 * 1024;
    if (body.length > MAX_BYTES) {
      res.status(413).json({ error: 'File too large (max 200MB)' });
      return;
    }

    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const client = getClient();
    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    res.status(200).json({ url: publicUrl, key });
  } catch (err) {
    console.error('[r2-upload] error:', err);
    res.status(500).json({ error: (err && err.message) || 'Upload failed' });
  }
}
