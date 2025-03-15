const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cookie = require("cookie");

admin.initializeApp();
const db = admin.firestore();

const COUPONS = ['COUPON1', 'COUPON2', 'COUPON3', 'COUPON4'];
const COOLDOWN_SECONDS = 3600; // 1 hour

const allowedOrigins = [
  'https://coupon-distribution-one.vercel.app',
  'https://coupon-distribution-nine.vercel.app'
];

exports.claimCoupon = functions.https.onRequest(async (req, res) => {
  const origin = req.get('Origin');

  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '');
  }

  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const ip = req.headers['fastly-client-ip'] ||
             req.headers['x-forwarded-for'] ||
             req.connection.remoteAddress;

  console.log("Detected IP:", ip);

  const cookies = cookie.parse(req.headers.cookie || '');
  const cookieId = cookies.couponClaimed || null;

  const now = admin.firestore.Timestamp.now();
  const cutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - COOLDOWN_SECONDS * 1000);

  try {
    const ipDocRef = db.collection('claims').doc(ip);
    const ipDoc = await ipDocRef.get();

    // ✅ Debug log IP doc details
    console.log(`IP doc exists: ${ipDoc.exists}`);
    if (ipDoc.exists) {
      const lastClaimTime = ipDoc.data().lastClaim.toMillis();
      console.log(`IP lastClaim: ${lastClaimTime}`);
      
      // Check if IP is still on cooldown
      if (lastClaimTime > cutoff.toMillis()) {
        const nextAttemptIn = COOLDOWN_SECONDS - ((now.toMillis() - lastClaimTime) / 1000);
        
        return res.status(429).json({
          message: 'You have already claimed a coupon recently with this IP. Please wait.',
          nextAttemptIn
        });
      }
    }

    // ✅ If cookie is present, block (Browser session protection)
    if (cookieId) {
      return res.status(429).json({
        message: 'You have already claimed a coupon in this browser session.',
      });
    }

    // ✅ Round Robin Coupon distribution logic
    const claimsSnapshot = await db.collection('claims').get();
    const count = claimsSnapshot.size;
    const coupon = COUPONS[count % COUPONS.length];

    // ✅ Save claim to Firestore for IP cooldown tracking
    await ipDocRef.set({
      lastClaim: now,
      coupon
    });

    // ✅ Set Cookie in Response (Browser-based cooldown)
    res.setHeader('Set-Cookie', cookie.serialize('couponClaimed', coupon, {
      maxAge: COOLDOWN_SECONDS,
      httpOnly: false,
      secure: true,
      sameSite: 'None',
      path: '/'
    }));

    // ✅ Success Response
    return res.json({
      message: `Success! Your coupon: ${coupon}`
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});
