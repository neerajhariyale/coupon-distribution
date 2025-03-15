import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(null);

  const claimCoupon = async () => {
    try {
      const res = await axios.post(
        'https://us-central1-roundrobin3112database.cloudfunctions.net/claimCoupon',
        {}, // no data since IP is auto detected by backend
        { withCredentials: true }
      );
      setMessage(res.data.message);
      if (res.data.nextAttemptIn) {
        setTimer(res.data.nextAttemptIn);
      }
    } catch (err) {
      setMessage('Error claiming coupon');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md text-center w-96">
        <h1 className="text-2xl font-bold mb-4">Coupon Distributor</h1>
        <button
          onClick={claimCoupon}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Claim Coupon
        </button>
        {message && (
          <div className="mt-4 p-2 bg-green-100 text-green-800 rounded">{message}</div>
        )}
        {timer && (
          <div className="mt-2 text-sm text-gray-600">
            Try again in {Math.ceil(timer / 60)} minutes.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
