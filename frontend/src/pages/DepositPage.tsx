import { useState, useEffect, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/toastSlice';
import api from '../api/axios';
import { QrCode, Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const DepositPage = () => {
  const [txHash, setTxHash] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [copied, setCopied] = useState(false);
  const [walletAddress, setWalletAddress] = useState('Loading address...');
  const [qrSrc, setQrSrc] = useState('/admin_qr.png');
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchAddress = async () => {
      try {
        const res = await api.get('/user/deposit-address');
        setWalletAddress(res.data.walletAddress);
      } catch (err) {
        console.error('Failed to fetch wallet address:', err);
        setWalletAddress('Error fetching address');
      }
    };
    fetchAddress();
  }, []);

  useEffect(() => {
    if (walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address') {
      const isTron = walletAddress.startsWith('T');
      setQrSrc(isTron ? '/tron_qr.jpeg' : '/eth_qr.png');
    }
  }, [walletAddress]);

  const handleQrError = () => {
    if (walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address') {
      const isTron = walletAddress.startsWith('T');
      
      // If Ethereum's /eth_qr.png fails, try /admin_qr.png before falling back to the API generator
      if (!isTron && qrSrc === '/eth_qr.png') {
        setQrSrc('/admin_qr.png');
        return;
      }

      const dynamicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(walletAddress)}`;
      if (qrSrc !== dynamicUrl) {
        setQrSrc(dynamicUrl);
      }
    }
  };

  const copyToClipboard = () => {
    if (walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address') {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      dispatch(addToast({ message: 'Address copied to clipboard!', type: 'success' }));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/user/deposit', {
        txHash,
        amountUSD,
      });
      const msg = 'Deposit submitted successfully! Pending admin verification.';
      setSuccess(msg);
      dispatch(addToast({ message: msg, type: 'success' }));
      setTxHash('');
      setAmountUSD('');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to submit deposit';
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Deposit Funds</h1>
        <p className="text-gray-400 mt-2">Send USDT (TRC20/ERC20) to the address below</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-4 rounded-2xl mb-4 shadow-inner flex items-center justify-center min-w-[224px] min-h-[224px]">
            {walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address' ? (
              <img
                src={qrSrc}
                alt="Deposit QR Code"
                className="w-48 h-48 block rounded-lg select-none"
                onError={handleQrError}
              />
            ) : (
              <QrCode className="w-48 h-48 text-gray-400 animate-pulse" />
            )}
          </div>
          
          <div className="w-full max-w-md bg-gray-950 rounded-xl p-4 flex items-center justify-between border border-gray-800">
            <code className="text-sm text-indigo-400 truncate pr-4">{walletAddress}</code>
            <button onClick={copyToClipboard} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
              {copied ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <h3 className="text-lg font-semibold text-white mb-4">Submit Payment Details</h3>
          
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Amount Sent (USD)</label>
              <input
                type="number"
                step="0.01"
                value={amountUSD}
                onChange={(e) => setAmountUSD(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="100.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Transaction Hash (TxID)</label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="0x..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit for Verification'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DepositPage;
