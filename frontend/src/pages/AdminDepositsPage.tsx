import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/toastSlice';
import api from '../api/axios';
import { ArrowDownToLine, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface Deposit {
  id: string;
  txHash: string;
  amountUSD: number;
  walletAddress: string | null;
  status: string;
  adminEnteredRate: number | null;
  equivalentINR: number | null;
  createdAt: string;
  user: { email: string; userId: string };
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400'}`;
};

const AdminDepositsPage = () => {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const dispatch = useDispatch();

  useEffect(() => {
    let active = true;
    const fetchDeposits = async () => {
      try {
        const res = await api.get('/admin/deposits');
        if (active) {
          setDeposits(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchDeposits();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleAction = async (depositId: string, action: 'APPROVED' | 'REJECTED') => {
    setActionLoading(depositId);
    try {
      await api.post(`/admin/deposit/${depositId}/verify`, {
        action,
      });
      dispatch(addToast({ message: `Deposit ${action === 'APPROVED' ? 'approved' : 'rejected'} successfully!`, type: 'success' }));
      setRefreshKey(prev => prev + 1);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Action failed';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-gray-400 p-8">Loading deposits...</div>;

  const pendingDeposits = deposits.filter(d => d.status === 'PENDING');
  const processedDeposits = deposits.filter(d => d.status !== 'PENDING');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Verify Deposits</h1>
        <p className="text-gray-400 text-sm mt-1">Review and approve user crypto deposit submissions</p>
      </div>

      {/* Pending Deposits */}
      <div>
        <h2 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Pending Verification ({pendingDeposits.length})
        </h2>
        {pendingDeposits.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            No pending deposits to review
          </div>
        ) : (
          <div className="space-y-4">
            {pendingDeposits.map((deposit) => (
              <div key={deposit.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-xl">
                        <ArrowDownToLine className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">User</p>
                        <p className="text-white font-medium">{deposit.user.email} <span className="text-gray-500 text-xs">({deposit.user.userId})</span></p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 pl-12">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Amount</p>
                        <p className="text-lg font-bold text-white">${deposit.amountUSD.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Tx Hash</p>
                        <p className="text-sm text-indigo-400 font-mono truncate">{deposit.txHash}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Date</p>
                        <p className="text-sm text-gray-300">{new Date(deposit.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(deposit.id, 'APPROVED')}
                      disabled={actionLoading === deposit.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                      {actionLoading === deposit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(deposit.id, 'REJECTED')}
                      disabled={actionLoading === deposit.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed Deposits */}
      {processedDeposits.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-400 mb-4">Processed Deposits</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Rate</th>
                  <th className="px-6 py-4 font-medium">INR Value</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {processedDeposits.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4 text-gray-300">{d.user.email}</td>
                    <td className="px-6 py-4 font-medium text-white">${d.amountUSD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-400">{d.adminEnteredRate ? `₹${d.adminEnteredRate}` : '—'}</td>
                    <td className="px-6 py-4 text-gray-300">{d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-6 py-4"><span className={statusBadge(d.status)}>{d.status}</span></td>
                    <td className="px-6 py-4 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDepositsPage;
