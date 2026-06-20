import { useEffect, useState, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/toastSlice';
import api from '../api/axios';
import { Building2, Landmark, CheckCircle2, Loader2, AlertCircle, RefreshCw, Calculator } from 'lucide-react';

const WithdrawPage = () => {
  const [amountUSD, setAmountUSD] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [inrRate, setInrRate] = useState<number>(94.0);
  const [rateLoading, setRateLoading] = useState<boolean>(true);
  const dispatch = useDispatch();

  useEffect(() => {
    let active = true;
    const fetchRate = async () => {
      try {
        const res = await api.get('/user/rate');
        if (active && res.data && typeof res.data.rate === 'number') {
          setInrRate(res.data.rate);
        }
      } catch (err) {
        console.warn('Failed to fetch custom USD/INR rate from backend:', err);
      } finally {
        if (active) {
          setRateLoading(false);
        }
      }
    };
    fetchRate();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const amountINR = (parseFloat(amountUSD) * inrRate).toFixed(2);

    try {
      await api.post('/user/withdraw', {
        amountUSD,
        amountINR,
        accountHolder,
        accountNumber,
        ifsc
      });
      const msg = `Withdrawal request submitted successfully! Approximate amount: ₹${parseFloat(amountINR).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Pending admin approval.`;
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

        {/* Live Exchange Rate Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex items-center justify-between mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-lg">
              <RefreshCw className={`w-4 h-4 text-indigo-400 ${rateLoading ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Exchange Rate (Live)</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {rateLoading ? 'Fetching latest rates...' : `1 USD = ₹${inrRate.toFixed(2)} INR`}
              </p>
            </div>
          </div>
          <div className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-lg font-semibold border border-indigo-500/20">
            USD / INR
          </div>
        </div>

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
            {amountUSD && !isNaN(parseFloat(amountUSD)) && (
              <div className="mt-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-start gap-3 shadow-inner">
                <Calculator className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <span className="text-xs text-gray-400 font-semibold block mb-0.5">CONVERSION SUMMARY</span>
                  <p className="text-white font-bold text-lg">
                    ₹{(parseFloat(amountUSD) * inrRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 font-mono">
                    Formula: ${parseFloat(amountUSD).toFixed(2)} USD × {inrRate.toFixed(4)}
                  </p>
                </div>
              </div>
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
