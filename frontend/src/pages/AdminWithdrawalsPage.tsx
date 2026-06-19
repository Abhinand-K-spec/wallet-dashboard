import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/toastSlice';
import api from '../api/axios';
import { ArrowUpFromLine, CheckCircle2, XCircle, Clock, CreditCard, Loader2 } from 'lucide-react';

interface Withdrawal {
  id: string;
  amountUSD: number;
  amountINR: number;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  status: string;
  utr: string | null;
  createdAt: string;
  user: { email: string; userId: string };
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
    PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400'}`;
};

const AdminWithdrawalsPage = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const dispatch = useDispatch();

  useEffect(() => {
    let active = true;
    const fetchWithdrawals = async () => {
      try {
        const res = await api.get('/admin/withdrawals');
        if (active) {
          setWithdrawals(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchWithdrawals();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleAction = async (withdrawalId: string, action: 'APPROVED' | 'REJECTED' | 'PAID') => {
    if (action === 'PAID' && !utrInputs[withdrawalId]) {
      dispatch(addToast({ message: 'Please enter a UTR number before marking as paid.', type: 'error' }));
      return;
    }
    setActionLoading(withdrawalId);
    try {
      await api.post(`/admin/withdrawal/${withdrawalId}/manage`, {
        action,
        utr: action === 'PAID' ? utrInputs[withdrawalId] : undefined,
      });
      dispatch(addToast({ message: `Withdrawal successfully marked as ${action.toLowerCase()}!`, type: 'success' }));
      setRefreshKey(prev => prev + 1);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Action failed';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-gray-400 p-8">Loading withdrawals...</div>;

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');
  const approvedWithdrawals = withdrawals.filter(w => w.status === 'APPROVED');
  const completedWithdrawals = withdrawals.filter(w => ['PAID', 'REJECTED'].includes(w.status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Manage Withdrawals</h1>
        <p className="text-gray-400 text-sm mt-1">Approve, reject, or mark withdrawal requests as paid</p>
      </div>

      {/* Pending Withdrawals */}
      <div>
        <h2 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Pending Approval ({pendingWithdrawals.length})
        </h2>
        {pendingWithdrawals.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            No pending withdrawal requests
          </div>
        ) : (
          <div className="space-y-4">
            {pendingWithdrawals.map((w) => (
              <div key={w.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-xl">
                        <ArrowUpFromLine className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">User</p>
                        <p className="text-white font-medium">{w.user.email} <span className="text-gray-500 text-xs">({w.user.userId})</span></p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 pl-12">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">USD Amount</p>
                        <p className="text-lg font-bold text-white">${w.amountUSD.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">INR Amount</p>
                        <p className="text-lg font-bold text-emerald-400">₹{w.amountINR.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Account</p>
                        <p className="text-sm text-gray-300">{w.accountHolder}</p>
                        <p className="text-xs text-gray-500">{w.accountNumber} • {w.ifsc}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Date</p>
                        <p className="text-sm text-gray-300">{new Date(w.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(w.id, 'APPROVED')}
                      disabled={actionLoading === w.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                      {actionLoading === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(w.id, 'REJECTED')}
                      disabled={actionLoading === w.id}
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

      {/* Approved — Awaiting Payment */}
      {approvedWithdrawals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Approved — Awaiting Payment ({approvedWithdrawals.length})
          </h2>
          <div className="space-y-4">
            {approvedWithdrawals.map((w) => (
              <div key={w.id} className="bg-gray-900 border border-blue-500/20 rounded-2xl p-6 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-xl">
                        <ArrowUpFromLine className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{w.user.email}</p>
                        <p className="text-sm text-gray-400">{w.accountHolder} • {w.accountNumber} • {w.ifsc}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 pl-12 mt-2">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Pay Amount</p>
                        <p className="text-xl font-bold text-emerald-400">₹{w.amountINR.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">USD Equiv.</p>
                        <p className="text-lg font-medium text-gray-300">${w.amountUSD.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">UTR Number</label>
                      <input
                        type="text"
                        value={utrInputs[w.id] || ''}
                        onChange={(e) => setUtrInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                        className="w-44 bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="UTR123456789"
                      />
                    </div>
                    <button
                      onClick={() => handleAction(w.id, 'PAID')}
                      disabled={actionLoading === w.id}
                      className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                      {actionLoading === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Mark Paid
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed/Rejected */}
      {completedWithdrawals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-400 mb-4">Completed / Rejected</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">USD</th>
                  <th className="px-6 py-4 font-medium">INR</th>
                  <th className="px-6 py-4 font-medium">Bank</th>
                  <th className="px-6 py-4 font-medium">UTR</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {completedWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4 text-gray-300">{w.user.email}</td>
                    <td className="px-6 py-4 font-medium text-white">${w.amountUSD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">₹{w.amountINR.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{w.accountHolder}<br/>{w.accountNumber}</td>
                    <td className="px-6 py-4 text-indigo-400 font-mono text-xs">{w.utr || '—'}</td>
                    <td className="px-6 py-4"><span className={statusBadge(w.status)}>{w.status}</span></td>
                    <td className="px-6 py-4 text-gray-500">{new Date(w.createdAt).toLocaleDateString()}</td>
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

export default AdminWithdrawalsPage;
