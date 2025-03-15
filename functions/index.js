const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cookie = require("cookie");

admin.initializeApp();
const db = admin.firestore();

const COUPONS = ['COUPON1', 'COUPON2', 'COUPON3', 'COUPON4'];
const COOLDOWN_SECONDS = 3600; // 1 hour

exports.claimCoupon = functions.https.onRequest(async (req, res) => {
  // ✅ CORS Setup: Specify the frontend URL, not '*'
  res.set('Access-Control-Allow-Origin', 'https://coupon-distribution-one.vercel.app'); 
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Headers', ' Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // ✅ Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const ip = req.headers['fastly-client-ip'] ||
             req.headers['x-forwarded-for'] ||
             req.connection.remoteAddress;

  const cookies = cookie.parse(req.headers.cookie || '');
  const cookieId = cookies.couponClaimed || null;

  const now = admin.firestore.Timestamp.now();
  const cutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - COOLDOWN_SECONDS * 1000);

  try {
    // Check IP abuse
    const ipDoc = await db.collection('claims').doc(ip).get();
    if (ipDoc.exists && ipDoc.data().lastClaim.toMillis() > cutoff.toMillis()) {
      const nextAttemptIn = COOLDOWN_SECONDS - ((now.toMillis() - ipDoc.data().lastClaim.toMillis()) / 1000);
      return res.status(429).json({
        message: 'You have already claimed a coupon recently. Please wait.',
        nextAttemptIn
      });
    }

    // Check cookie abuse
    if (cookieId) {
      return res.status(429).json({
        message: 'You have already claimed a coupon on this browser session.',
      });
    }

    // Round Robin Coupon distribution logic
    const claimsSnapshot = await db.collection('claims').get();
    const count = claimsSnapshot.size;
    const coupon = COUPONS[count % COUPONS.length];

    // Save claim to Firestore
    await db.collection('claims').doc(ip).set({
      lastClaim: now,
      coupon
    });

    // Set a cookie (expires in 1 hour)
    res.setHeader('Set-Cookie', cookie.serialize('couponClaimed', coupon, {
      maxAge: COOLDOWN_SECONDS,
      httpOnly: false,  // ❗️ Consider making this true in production if not accessing in JS
      secure: true,      // ✅ Required for cross-origin cookies (Vercel frontend is HTTPS)
      sameSite: 'None',  // ✅ Required for cross-origin cookies
      path: '/',
    }));

    return res.json({
      message: `Success! Your coupon: ${coupon}`
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});
