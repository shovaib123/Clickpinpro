// ✅ Bunny Stream PROXY — ye Vercel serverless function hai.
// Iska kaam: browser se request lo, Bunny.net ko forward karo (secret
// AccessKey yahin, server-side, add karke — browser ko API key kabhi
// dikhti hi nahi), aur response wapas browser ko de do.
//
// YE FILE ZARURI HAI kyunki Bunny Stream ka API seedha browser JS se
// call nahi ho sakta (Bunny ki apni documentation ke mutabik — unka
// authentication model server-side proxy ke liye design kiya gaya hai,
// browser se direct call CORS ki wajah se block ho jaati hai).
//
// ═══════════════════════════════════════════════════════════════
// SETUP (ek baar karna hai):
// ═══════════════════════════════════════════════════════════════
// 1. Is file ko apne Vercel project mein "api/bunny-proxy.js" path
//    par daalo (jaise index.html hai, uske saath hi ek "api" folder
//    banao aur usme ye file rakho).
// 2. Vercel dashboard → apna project → Settings → Environment Variables
//    → naya variable add karo:
//       Name:  BUNNY_API_KEY
//       Value: 5d229741-41b0-4672-a58d021248a2-1c5c-4f2a
//    (Isse API key sirf Vercel ke server pe secret rehti hai, kabhi
//    bhi browser/HTML file mein publicly dikhti nahi.)
// 3. Redeploy karo (Vercel khud automatically kar dega jab file push hogi,
//    ya "Redeploy" button dabao dashboard mein).
// 4. Bas — is ke baad video upload turant Bunny.net pe kaam karega,
//    Cloudinary fallback ki zarurat hi nahi padegi.
// ═══════════════════════════════════════════════════════════════

export const config = {
  api: {
    bodyParser: false, // ✅ raw binary video data ko bina modify kiye pass-through karne ke liye zaroori
  },
};

const BUNNY_LIBRARY_ID = '702316';

export default async function handler(req, res) {
  // ✅ CORS headers — taaki tumhari app (kisi bhi domain se) is proxy ko call kar sake
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.BUNNY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'BUNNY_API_KEY environment variable set nahi hai Vercel dashboard mein' });
    return;
  }

  const { guid, title } = req.query;
  const base = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`;
  const bunnyUrl = guid ? `${base}/${guid}` : base;

  try {
    if (req.method === 'POST') {
      // ✅ Naya video "slot" create karo
      const bunnyRes = await fetch(bunnyUrl, {
        method: 'POST',
        headers: {
          'AccessKey': apiKey,
          'accept': 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: title || 'Untitled' }),
      });
      const data = await bunnyRes.text();
      res.status(bunnyRes.status).send(data);
      return;
    }

    if (req.method === 'PUT') {
      // ✅ Actual video file (raw binary) upload karo — stream karke,
      // memory mein poori file load kiye bina (bade files ke liye zaroori)
      const bunnyRes = await fetch(bunnyUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: req,
        duplex: 'half',
      });
      const data = await bunnyRes.text();
      res.status(bunnyRes.status).send(data);
      return;
    }

    if (req.method === 'GET') {
      // ✅ Processing status check karo (polling ke liye)
      const bunnyRes = await fetch(bunnyUrl, {
        method: 'GET',
        headers: { 'AccessKey': apiKey, 'accept': 'application/json' },
      });
      const data = await bunnyRes.text();
      res.status(bunnyRes.status).send(data);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Proxy error: ' + e.message });
  }
}
