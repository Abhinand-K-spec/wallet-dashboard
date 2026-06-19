import { useEffect, useState } from 'react';
import api from '../api/axios';
import { ArrowDownToLine, ArrowUpFromLine, Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Transaction {
  id: string;
  transactionType: string;
  amountUSD: number;
  amountINR: number | null;
  reference: string | null;
  status: string;
  createdAt: string;
}

interface Deposit {
  id: string;
  txHash: string;
  amountUSD: number;
  status: string;
  equivalentINR: number | null;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  amountUSD: number;
  amountINR: number;
  accountHolder: string;
  status: string;
  utr: string | null;
  createdAt: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
    case 'PAID':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'PENDING':
      return <Clock className="w-4 h-4 text-amber-400" />;
    case 'REJECTED':
    case 'FAILED':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
};

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
    FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`;
};

type TabType = 'all' | 'deposits' | 'withdrawals';

const HistoryPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/user/transactions');
        setTransactions(res.data.transactions);
        setDeposits(res.data.deposits);
        setWithdrawals(res.data.withdrawals);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-gray-400 p-8">Loading history...</div>;

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All Transactions', count: transactions.length },
    { key: 'deposits', label: 'Deposits', count: deposits.length },
    { key: 'withdrawals', label: 'Withdrawals', count: withdrawals.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Transaction History</h1>
        <p className="text-gray-400 text-sm mt-1">View all your deposits, withdrawals, and transactions</p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            {tab.label} <span className="ml-1 text-xs opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* All Transactions Tab */}
      {activeTab === 'all' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Activity className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-lg font-medium">No transactions yet</p>
              <p className="text-sm mt-1">Make a deposit or withdrawal to see your transaction history</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount (USD)</th>
                  <th className="px-6 py-4 font-medium">Amount (INR)</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                        tx.transactionType === 'DEPOSIT' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        {tx.transactionType === 'DEPOSIT'
                          ? <ArrowDownToLine className="w-3 h-3" />
                          : <ArrowUpFromLine className="w-3 h-3" />}
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">${tx.amountUSD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">{tx.amountINR ? `₹${tx.amountINR.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={statusBadge(tx.status)}>
                        {statusIcon(tx.status)}
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Deposits Tab */}
      {activeTab === 'deposits' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {deposits.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ArrowDownToLine className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-lg font-medium">No deposits yet</p>
              <p className="text-sm mt-1">Submit a crypto deposit to get started</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Tx Hash</th>
                  <th className="px-6 py-4 font-medium">USD</th>
                  <th className="px-6 py-4 font-medium">INR Value</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-indigo-400 text-xs truncate max-w-[200px]">{d.txHash}</td>
                    <td className="px-6 py-4 font-medium text-white">${d.amountUSD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">{d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={statusBadge(d.status)}>
                        {statusIcon(d.status)}
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(d.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === 'withdrawals' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {withdrawals.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ArrowUpFromLine className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-lg font-medium">No withdrawals yet</p>
              <p className="text-sm mt-1">Request a withdrawal to see it here</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Holder</th>
                  <th className="px-6 py-4 font-medium">USD</th>
                  <th className="px-6 py-4 font-medium">INR</th>
                  <th className="px-6 py-4 font-medium">UTR</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4 text-gray-300">{w.accountHolder}</td>
                    <td className="px-6 py-4 font-medium text-white">${w.amountUSD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">₹{w.amountINR.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 font-mono text-indigo-400 text-xs">{w.utr || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={statusBadge(w.status)}>
                        {statusIcon(w.status)}
                        {w.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(w.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
