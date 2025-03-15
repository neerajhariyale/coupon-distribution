import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(null);
  const [loading, setLoading] = useState(false);

  const claimCoupon = async () => {
    setLoading(true);
    setMessage('');
    try {
      //firebase url ( backend)
      const res = await axios.post(
        'https://us-central1-roundrobin3112database.cloudfunctions.net/claimCoupon',
        {}, 
        { withCredentials: true }
      );

      // Success
      setMessage(res.data.message);

      if (res.data.nextAttemptIn) {
        setTimer(res.data.nextAttemptIn);
      } else {
        setTimer(null);
      }

    } catch (err) {
      if (err.response) {
        if (err.response.status === 429) {
          const data = err.response.data;
          setMessage(data.message || 'Too many requests! Try again later.');
          if (data.nextAttemptIn) {
            setTimer(data.nextAttemptIn);
          }
        } else {
          setMessage(`Server Error (${err.response.status}): ${err.response.data.message || 'Unexpected error'}`);
        }
      } else {
        setMessage('Network error or server not responding.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer for the user
  useEffect(() => {
    if (!timer) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md text-center w-96">
        <h1 className="text-2xl font-bold mb-4">Coupon Distributor</h1>

        <button
          onClick={claimCoupon}
          disabled={loading || (timer && timer > 0)} 
          className={`px-4 py-2 rounded text-white cursor-pointer transition-all ${
            loading || (timer && timer > 0)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Processing...' : 'Claim Coupon'}
        </button>

        {message && (
          <div className="mt-4 p-2 bg-green-100 text-green-800 rounded">{message}</div>
        )}

        {timer !== null && (
          <div className="mt-2 text-sm text-gray-600">
            Try again in {Math.ceil(timer / 60)} minutes {Math.ceil(timer % 60)} seconds.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
