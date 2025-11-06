import { Card } from '../components/ui/card';
import { Users, TrendingUp, MessageSquare, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';

export default function Dashboard() {
  const metrics = [
    { label: 'Subscribers', value: '1,238', icon: Users, trend: 'up', trendValue: '+12%' },
    { label: 'Engagement Rate', value: '72%', icon: TrendingUp, trend: 'up', trendValue: '+5%' },
    { label: 'Messages This Week', value: '342', icon: MessageSquare, trend: 'down', trendValue: '-3%' },
    { label: 'Revenue (Monthly)', value: '$6,920', icon: DollarSign, trend: 'up', trendValue: '+18%' },
  ];

  const fanInteractions = [
    { 
      name: 'Sarah Thompson', 
      message: "What's your morning routine? I struggle to wake up early and be productive.", 
      time: '2 hours ago', 
      avatar: 'ST',
      fullMessage: "Hey! I've been following you for months and I love your energy. What's your actual morning routine? I struggle to wake up early and stay productive. Any tips?"
    },
    { 
      name: 'Max Media', 
      message: 'Best camera for beginners? Looking to start a YouTube channel...', 
      time: '5 hours ago', 
      avatar: 'MM',
      fullMessage: "Best camera for beginners? I'm looking to start a YouTube channel focused on tech reviews. Budget is around $800-1000. What would you recommend?"
    },
    { 
      name: 'James Cook', 
      message: 'How do you stay motivated when content isn\'t performing well?', 
      time: '1 day ago', 
      avatar: 'JC',
      fullMessage: "How do you stay motivated when your content isn't performing well? I've been posting consistently but my views are down this month."
    },
    { 
      name: 'Lucy L', 
      message: 'Favorite productivity tools for content creators?', 
      time: '2 days ago', 
      avatar: 'LL',
      fullMessage: "What are your favorite productivity tools? I'm drowning in tasks between filming, editing, and social media. Need better systems!"
    },
  ];

  const suggestedTopics = [
    { topic: 'Morning Routines & Productivity', questions: 12, icon: '☀️' },
    { topic: 'Equipment & Gear Recommendations', questions: 8, icon: '📹' },
    { topic: 'Motivation & Mental Health', questions: 15, icon: '💪' },
    { topic: 'Content Strategy & Growth', questions: 6, icon: '📈' },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="p-6 bg-white rounded-xl shadow-sm border-0">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#7A5FFF]/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-[#7A5FFF]" />
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  <span>{metric.trendValue}</span>
                </div>
              </div>
              <div className="text-gray-500 text-sm mb-1">{metric.label}</div>
              <div className="text-2xl">{metric.value}</div>
            </Card>
          );
        })}
      </div>

      {/* Fan Interactions Feed - Live Preview */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <div className="flex items-center justify-between mb-4">
          <h2>Fan Interactions Feed — Live Preview</h2>
          <span className="text-sm text-gray-500">Most recent 4 chats</span>
        </div>
        <div className="space-y-3">
          {fanInteractions.map((interaction, index) => (
            <div key={index} className="p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white flex-shrink-0">
                  {interaction.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{interaction.name}</span>
                    <span className="text-xs text-gray-400">{interaction.time}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{interaction.fullMessage}</p>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-1 text-xs bg-[#7A5FFF] text-white rounded-lg hover:bg-[#6B4FEF] transition-colors">
                      Reply with AI
                    </button>
                    <button className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                      View Full Thread
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Suggested Topics to Train On */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <div className="flex items-center justify-between mb-4">
          <h2>Suggested Training Topics</h2>
          <span className="text-sm text-[#7A5FFF]">Based on fan questions</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {suggestedTopics.map((item, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-gradient-to-br from-[#7A5FFF]/5 to-[#A689FF]/5 border border-[#7A5FFF]/20 hover:border-[#7A5FFF]/40 transition-colors cursor-pointer"
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-sm mb-1">{item.topic}</div>
              <div className="text-xs text-gray-600">{item.questions} questions asked</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

