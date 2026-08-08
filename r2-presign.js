// api/r2-presign.js
// ✅ Ye function file KHUD upload nahi karta — ye sirf ek "permission slip"
// (presigned URL) banata hai jisse browser SEEDHA Cloudflare R2 mein file
// bhej sakta hai. Isse Vercel ke serverless function body-size limit
// (~4.5MB) ka koi issue nahi aata — video chahe 500MB ka ho, seedha jaata hai.
//
// Zaroori Vercel Environment Variables (already set hain agar pichhla setup
// follow kiya tha):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
//
// ⚠️ EXTRA STEP ZAROORI: R2 bucket pe CORS enable karna hoga taaki browser
// seedha upload kar sake. Neeche CLOUDFLARE-R2-SETUP.md mein steps hain.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

function safeExtFromNameOrType(filename, contentType) {
  const fromName = (filename || '').split('.').pop();
  if (fromName && fromName.length <= 5 && /^[a-zA-Z0-9]+$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = (contentType || '').split('/').pop();
  return (fromType || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed, use GET' });
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
    const contentType = typeof req.query.type === 'string' ? req.query.type : 'application/octet-stream';
    const ext = safeExtFromNameOrType(filename, contentType);
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const client = getClient();
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 }); // 10 min

    const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    res.status(200).json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error('[r2-presign] error:', err);
    res.status(500).json({ error: (err && err.message) || 'Presign failed' });
  }
}
