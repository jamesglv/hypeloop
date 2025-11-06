import { Card } from '../components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Users, CreditCard } from 'lucide-react';

export default function Earnings() {
  const monthlyData = [
    { month: 'May', revenue: 4200 },
    { month: 'Jun', revenue: 4800 },
    { month: 'Jul', revenue: 5300 },
    { month: 'Aug', revenue: 5100 },
    { month: 'Sep', revenue: 5900 },
    { month: 'Oct', revenue: 6400 },
    { month: 'Nov', revenue: 6920 },
  ];

  return (
    <div className="space-y-6">
      <h1>Earnings</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#7A5FFF]/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#7A5FFF]" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Monthly Revenue</div>
              <div className="text-2xl">$6,920</div>
            </div>
          </div>
          <div className="text-sm text-green-600">+18% from last month</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#7A5FFF]/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-[#7A5FFF]" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Active Subscribers</div>
              <div className="text-2xl">1,238</div>
            </div>
          </div>
          <div className="text-sm text-green-600">+142 this month</div>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="mb-6">Monthly Revenue Growth</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#7A5FFF"
              strokeWidth={3}
              dot={{ fill: '#7A5FFF', strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Breakdown Table */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <h2 className="mb-4">Revenue Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Subscriber Count</span>
              <span className="text-lg">1,238</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">ARPU (Avg Revenue Per User)</span>
              <span className="text-lg">$5.59</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">MRR (Monthly Recurring Revenue)</span>
              <span className="text-lg text-[#7A5FFF]">$6,920</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">Platform Fee (15%)</span>
              <span className="text-lg text-red-600">-$1,038</span>
            </div>
            <div className="flex justify-between items-center py-3 pt-4 border-t-2 border-gray-200">
              <span>Net Revenue</span>
              <span className="text-xl text-green-600">$5,882</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <h2 className="mb-4">Payout Summary</h2>
          <div className="space-y-4">
            <div className="p-4 bg-[#7A5FFF]/5 rounded-xl border border-[#7A5FFF]/20">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-[#7A5FFF]" />
                <span className="text-gray-600">Next Payout</span>
              </div>
              <div className="text-2xl text-[#7A5FFF] mb-1">$6,920</div>
              <div className="text-sm text-gray-600">Due on Nov 15, 2025</div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-600">Recent Payouts</div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Oct 2025</span>
                <span className="text-sm">$6,400</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Sep 2025</span>
                <span className="text-sm">$5,900</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Aug 2025</span>
                <span className="text-sm">$5,100</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Payout Method</div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-6 bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                  ****
                </div>
                <span>•••• •••• •••• 4242</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

