import { useState, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/toastSlice';
import api from '../api/axios';
import { Building2, Landmark, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const WithdrawPage = () => {
  const [amountUSD, setAmountUSD] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const dispatch = useDispatch();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Hardcoded demo conversion rate (should ideally be fetched from backend or real-time API)
    const INR_RATE = 83.5;
    const amountINR = (parseFloat(amountUSD) * INR_RATE).toFixed(2);

    try {
      await api.post('/user/withdraw', {
        amountUSD,
        amountINR,
        accountHolder,
        accountNumber,
        ifsc
      });
      const msg = 'Withdrawal request submitted successfully! Pending admin approval.';
      setSuccess(msg);
      dispatch(addToast({ message: msg, type: 'success' }));
      setAmountUSD('');
      setAccountHolder('');
      setAccountNumber('');
      setIfsc('');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to submit withdrawal request';
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Withdraw to Bank (INR)</h1>
        <p className="text-gray-400 mt-2">Enter your Indian bank details to request a withdrawal</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
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
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Withdrawal Amount (USD)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={amountUSD}
                onChange={(e) => setAmountUSD(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="100.00"
                required
              />
              <span className="absolute left-4 top-3 text-gray-500 font-medium">$</span>
            </div>
            {amountUSD && (
              <p className="text-sm text-indigo-400 mt-2 ml-1">
                Approximate INR: ₹{(parseFloat(amountUSD) * 83.5).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" />
              Bank Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    placeholder="1234567890"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">IFSC Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 uppercase"
                      placeholder="HDFC0001234"
                      required
                    />
                    <Building2 className="w-5 h-5 text-gray-500 absolute left-4 top-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Withdrawal'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WithdrawPage;
