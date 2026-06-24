import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/toastSlice';
import api from '../api/axios';
import { RefreshCw, ArrowLeft, Loader2 } from 'lucide-react';
import { PaymentAmountInput } from '../components/PaymentAmountInput';
import { DynamicPaymentQR } from '../components/DynamicPaymentQR';
import { useQuery, useMutation } from '@tanstack/react-query';

interface RateResponse {
  rate: number;
}

interface PaymentOrderResponse {
  orderId: string;
  walletAddress: string;
  amount: string;
  network: string;
  qrPayload: string;
  expiresAt: string;
}

interface PaymentStatusResponse {
  status: 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'FAILED';
  orderId: string;
  amount: string;
  txHash?: string;
}

const DepositPage = () => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USDT' | 'INR'>('USDT');
  const [exchangeRate, setExchangeRate] = useState<number>(83.50);
  const [rateLoading, setRateLoading] = useState(true);
  const dispatch = useDispatch();

  // Active Payment State
  const [paymentState, setPaymentState] = useState<'idle' | 'creating' | 'generated' | 'expired' | 'paid' | 'failed'>('idle');
  const [activeOrder, setActiveOrder] = useState<PaymentOrderResponse | null>(null);

  // Fetch Exchange Rate
  const fetchRate = async () => {
    const res = await api.get<RateResponse>('/user/rate');
    return res.data;
  };

  const { data: rateData, isFetching: isRateFetching } = useQuery({
    queryKey: ['exchangeRate'],
    queryFn: fetchRate,
    refetchInterval: 60000, // Refresh rate every minute
  });

  useEffect(() => {
    if (rateData && typeof rateData.rate === 'number') {
      Promise.resolve().then(() => {
        setExchangeRate(rateData.rate);
        setRateLoading(false);
      });
    }
  }, [rateData]);

  // Create Payment Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: { amount: string; currency: 'USDT' | 'INR' }) => {
      const res = await api.post<PaymentOrderResponse>('/payments/create', payload);
      return res.data;
    },
    onMutate: () => {
      setPaymentState('creating');
    },
    onSuccess: (data) => {
      setActiveOrder(data);
      setPaymentState('generated');
      dispatch(addToast({ message: 'Payment order generated successfully!', type: 'success' }));
    },
    onError: (err: unknown) => {
      Promise.resolve().then(() => {
        setPaymentState('idle');
      });
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errMsg = axiosError.response?.data?.error || 'Failed to generate payment order.';
      dispatch(addToast({ message: errMsg, type: 'error' }));
    },
  });

  // Poll Payment Order Status Query
  const { data: statusData } = useQuery({
    queryKey: ['paymentStatus', activeOrder?.orderId],
    queryFn: async () => {
      const res = await api.get<PaymentStatusResponse>(`/payments/status/${activeOrder?.orderId}`);
      return res.data;
    },
    enabled: !!activeOrder?.orderId && paymentState === 'generated',
    refetchInterval: (query) => {
      // Poll every 5 seconds if order is generated and pending
      const status = query.state.data?.status;
      if (status === 'SUCCESS' || status === 'EXPIRED' || status === 'FAILED') {
        return false;
      }
      return 5000;
    },
    retry: 3,
  });

  // Respond to status changes
  useEffect(() => {
    if (!statusData) return;

    if (statusData.status === 'SUCCESS') {
      Promise.resolve().then(() => {
        setPaymentState('paid');
      });
      dispatch(addToast({ message: 'Deposit verified and credited!', type: 'success' }));
    } else if (statusData.status === 'EXPIRED') {
      Promise.resolve().then(() => {
        setPaymentState('expired');
      });
      dispatch(addToast({ message: 'Payment order has expired.', type: 'error' }));
    } else if (statusData.status === 'FAILED') {
      Promise.resolve().then(() => {
        setPaymentState('failed');
      });
      dispatch(addToast({ message: 'Payment verification failed.', type: 'error' }));
    }
  }, [statusData, dispatch]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      dispatch(addToast({ message: 'Please enter an amount greater than 0', type: 'error' }));
      return;
    }
    createOrderMutation.mutate({ amount, currency });
  };

  const handleReset = () => {
    setPaymentState('idle');
    setActiveOrder(null);
    setAmount('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">Deposit Funds</h1>
        <p className="text-gray-400 mt-2">Send USDT (TRC20) via Trust Wallet for automatic balance credit</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        {paymentState === 'idle' || paymentState === 'creating' ? (
          /* Create Payment Form */
          <form onSubmit={handleGenerate} className="space-y-6">
            <PaymentAmountInput
              amount={amount}
              currency={currency}
              onChangeAmount={setAmount}
              onChangeCurrency={setCurrency}
              exchangeRate={exchangeRate}
              disabled={paymentState === 'creating'}
            />

            {/* Live Exchange Rate Card */}
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-lg">
                  <RefreshCw className={`w-4 h-4 text-indigo-400 ${rateLoading || isRateFetching ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Conversion Rate (Admin Configured)</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {rateLoading ? 'Fetching exchange rates...' : `1 USD = ₹${exchangeRate.toFixed(2)} INR`}
                  </p>
                </div>
              </div>
              <div className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-lg font-semibold border border-indigo-500/20">
                USDT / INR
              </div>
            </div>

            <button
              type="submit"
              disabled={paymentState === 'creating' || !amount || parseFloat(amount) <= 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold"
            >
              {paymentState === 'creating' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Order...
                </>
              ) : (
                'Generate Payment QR'
              )}
            </button>
          </form>
        ) : (
          /* Dynamic Payment QR Display & Countdown */
          <div className="space-y-4">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to edit amount
            </button>
            <DynamicPaymentQR
              state={paymentState}
              walletAddress={activeOrder?.walletAddress}
              amount={activeOrder?.amount}
              qrPayload={activeOrder?.qrPayload}
              expiresAt={activeOrder?.expiresAt}
              onReset={handleReset}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositPage;
