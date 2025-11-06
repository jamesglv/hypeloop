import { Card } from '../components/ui/card';
import { Search, Trophy } from 'lucide-react';
import { Badge } from '../components/ui/badge';

export default function Subscribers() {
  const subscribers = [
    {
      name: 'Sarah Thompson',
      avatar: 'ST',
      joinDate: 'Sept 2025',
      engagement: 96,
      messages: 182,
      lastActive: '2 hrs ago',
      value: '$9.99/mo',
    },
    {
      name: '@MaxMedia',
      avatar: 'MM',
      joinDate: 'Aug 2025',
      engagement: 88,
      messages: 129,
      lastActive: '1 day ago',
      value: '$4.99/mo',
    },
    {
      name: 'James Cook',
      avatar: 'JC',
      joinDate: 'Oct 2025',
      engagement: 82,
      messages: 98,
      lastActive: '3 days ago',
      value: '$9.99/mo',
    },
    {
      name: 'Lucy L',
      avatar: 'LL',
      joinDate: 'Sept 2025',
      engagement: 74,
      messages: 57,
      lastActive: '6 days ago',
      value: '$9.99/mo',
    },
    {
      name: '@AussieChef',
      avatar: 'AC',
      joinDate: 'Jul 2025',
      engagement: 68,
      messages: 41,
      lastActive: '1 week ago',
      value: '$4.99/mo',
    },
  ];

  const topFans = [
    { name: 'Sarah Thompson', streak: 120, medal: '🥇' },
    { name: '@MaxMedia', streak: 95, medal: '🥈' },
    { name: 'James Cook', streak: 87, medal: '🥉' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Subscribers</h1>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search subscribers…"
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
          />
        </div>
      </div>

      {/* Quick Stats - Now Above */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h3 className="mb-4">Quick Stats</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-gray-600 text-sm mb-1">Total Subscribers</div>
            <div className="text-2xl">1,238</div>
          </div>
          <div>
            <div className="text-gray-600 text-sm mb-1">Active This Week</div>
            <div className="text-2xl text-green-600">892</div>
          </div>
          <div>
            <div className="text-gray-600 text-sm mb-1">Avg Engagement</div>
            <div className="text-2xl">72%</div>
          </div>
          <div>
            <div className="text-gray-600 text-sm mb-1">New This Month</div>
            <div className="text-2xl text-[#7A5FFF]">+142</div>
          </div>
        </div>
      </Card>

      {/* Main Subscribers Table - Full Width */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <div className="space-y-1">
          {/* Table Header */}
          <div className="grid grid-cols-7 gap-4 px-4 py-3 text-sm text-gray-500">
            <div className="col-span-2">Fan</div>
            <div>Join Date</div>
            <div>Engagement</div>
            <div>Messages</div>
            <div>Last Active</div>
            <div>Value</div>
          </div>

          {/* Table Rows */}
          {subscribers.map((subscriber, index) => (
            <div
              key={index}
              className="grid grid-cols-7 gap-4 px-4 py-4 rounded-lg hover:bg-gray-50 transition-colors items-center"
            >
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white flex-shrink-0">
                  {subscriber.avatar}
                </div>
                <span>{subscriber.name}</span>
              </div>
              <div className="text-sm text-gray-600">{subscriber.joinDate}</div>
              <div className="flex items-center gap-2">
                <div className="w-full bg-gray-200 rounded-full h-2 max-w-[60px]">
                  <div
                    className="bg-[#7A5FFF] h-2 rounded-full"
                    style={{ width: `${subscriber.engagement}%` }}
                  ></div>
                </div>
                <span className="text-sm">{subscriber.engagement}</span>
              </div>
              <div className="text-sm">{subscriber.messages}</div>
              <div className="text-sm text-gray-600">{subscriber.lastActive}</div>
              <div className="text-sm">{subscriber.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Leaderboard - Now Below */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-[#7A5FFF]" />
          <h2>Top 3 Day-Ones</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {topFans.map((fan, index) => (
            <div key={index} className="p-4 bg-[#F9F9F9] rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{fan.medal}</span>
                <span>{fan.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[#7A5FFF]/10 text-[#7A5FFF] hover:bg-[#7A5FFF]/10">
                  Active {fan.streak} days
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

