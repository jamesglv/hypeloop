import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Users, TrendingUp, MessageSquare, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';
import { TrainingTopicsModal } from '../components/TrainingTopicsModal';

interface FanInteraction {
  name: string;
  message: string;
  time: string;
  avatar: string;
  fullMessage: string;
  fanId: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fanInteractions, setFanInteractions] = useState<FanInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<{ topic: string; icon: string; questions: string[] } | null>(null);

  const metrics = [
    { label: 'Subscribers', value: '1,238', icon: Users, trend: 'up', trendValue: '+12%' },
    { label: 'Engagement Rate', value: '72%', icon: TrendingUp, trend: 'up', trendValue: '+5%' },
    { label: 'Messages This Week', value: '342', icon: MessageSquare, trend: 'down', trendValue: '-3%' },
    { label: 'Revenue (Monthly)', value: '$6,920', icon: DollarSign, trend: 'up', trendValue: '+18%' },
  ];

  // Format time relative to now
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Generate avatar initials from name
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Fetch fan interactions from database
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchFanInteractions = async () => {
      try {
        // Get all fan messages for this creator, ordered by created_at
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, fan_id, content, created_at')
          .eq('creator_id', user.id)
          .eq('role', 'fan')
          .order('created_at', { ascending: false });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          setLoading(false);
          return;
        }

        if (!messages || messages.length === 0) {
          setFanInteractions([]);
          setLoading(false);
          return;
        }

        // Group by fan_id and get the latest message for each fan
        const fanMap = new Map<string, { content: string; created_at: string }>();
        messages.forEach((msg) => {
          if (!fanMap.has(msg.fan_id)) {
            fanMap.set(msg.fan_id, {
              content: msg.content,
              created_at: msg.created_at,
            });
          }
        });

        // Get unique fan IDs
        const fanIds = Array.from(fanMap.keys());

        // Fetch fan details
        const { data: fansData, error: fansError } = await supabase
          .from('fans')
          .select('id, display_name, username')
          .in('id', fanIds);

        if (fansError) {
          console.error('Error fetching fans:', fansError);
          setLoading(false);
          return;
        }

        // Build fan interactions array
        const interactions: FanInteraction[] = fanIds
          .map((fanId) => {
            const messageData = fanMap.get(fanId)!;
            const fanData = fansData?.find((f) => f.id === fanId);

            const displayName = fanData?.display_name || fanData?.username || 'Fan';
            const messageContent = messageData.content;
            const messagePreview = messageContent.length > 100 
              ? messageContent.substring(0, 100) + '...' 
              : messageContent;

            return {
              name: displayName,
              message: messagePreview,
              time: formatTimeAgo(new Date(messageData.created_at)),
              avatar: getInitials(displayName),
              fullMessage: messageContent,
              fanId: fanId,
            };
          })
          .sort((a, b) => {
            // Sort by time (most recent first)
            const timeA = fanMap.get(a.fanId)!.created_at;
            const timeB = fanMap.get(b.fanId)!.created_at;
            return new Date(timeB).getTime() - new Date(timeA).getTime();
          })
          .slice(0, 4); // Limit to 4 most recent

        setFanInteractions(interactions);
      } catch (error) {
        console.error('Error fetching fan interactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFanInteractions();

    // Subscribe to new messages in real-time
    const channel = supabase
      .channel(`creator-messages:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `creator_id=eq.${user.id}`,
        },
        () => {
          // Refetch interactions when a new message arrives
          fetchFanInteractions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const topicQuestions: Record<string, string[]> = {
    'Morning Routines & Productivity': [
      'What time do you wake up every morning?',
      'What is the first thing you do when you wake up?',
      'Do you have a morning meditation or mindfulness practice?',
      'What does your ideal morning routine look like?',
      'How do you stay productive throughout the day?',
      'What breakfast do you typically have?',
      'Do you exercise in the morning? If so, what type?',
      'How do you plan your day ahead?',
      'What tools or apps do you use for productivity?',
      'How do you handle morning distractions?',
      'What habits have had the biggest impact on your morning routine?',
      'How do you maintain consistency with your morning routine?',
    ],
    'Equipment & Gear Recommendations': [
      'What camera do you use for filming?',
      'What lighting setup do you recommend?',
      'What microphone do you use for audio?',
      'What editing software do you use?',
      'What tripod or stabilizer do you recommend?',
      'What storage solution do you use for your footage?',
      'What computer specs do you need for video editing?',
      'What accessories have made the biggest difference in your content creation?',
    ],
    'Motivation & Mental Health': [
      'How do you stay motivated on days when you don\'t feel like creating?',
      'What do you do when you experience creative burnout?',
      'How do you handle negative comments or criticism?',
      'What mental health practices do you follow?',
      'How do you balance work and personal life?',
      'What keeps you going during difficult times?',
      'How do you deal with imposter syndrome?',
      'What advice do you have for overcoming fear of failure?',
      'How do you maintain a positive mindset?',
      'What self-care routines do you practice?',
      'How do you handle stress and anxiety?',
      'What books or resources have helped your mental health?',
      'How do you set boundaries with your audience?',
      'What role does community play in your mental health?',
      'How do you celebrate small wins and progress?',
    ],
    'Content Strategy & Growth': [
      'How do you come up with content ideas?',
      'What posting schedule do you recommend?',
      'How do you analyze what content performs best?',
      'What strategies have helped you grow your audience?',
      'How do you engage with your community?',
      'What platforms do you focus on and why?',
    ],
  };

  const suggestedTopics = [
    { topic: 'Morning Routines & Productivity', questions: 12, icon: '☀️' },
    { topic: 'Equipment & Gear Recommendations', questions: 8, icon: '📹' },
    { topic: 'Motivation & Mental Health', questions: 15, icon: '💪' },
    { topic: 'Content Strategy & Growth', questions: 6, icon: '📈' },
  ];

  const handleTopicClick = (topic: string, icon: string) => {
    const questions = topicQuestions[topic] || [];
    setSelectedTopic({ topic, icon, questions });
  };

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
          <span className="text-sm text-gray-500">Most recent {fanInteractions.length} chats</span>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading messages...</div>
        ) : fanInteractions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No messages from fans yet</div>
        ) : (
          <div className="space-y-3">
            {fanInteractions.map((interaction) => (
              <div key={interaction.fanId} className="p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white flex-shrink-0">
                    {interaction.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{interaction.name}</span>
                      <span className="text-xs text-gray-400">{interaction.time}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{interaction.fullMessage}</p>
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => navigate(`/messages?fanId=${interaction.fanId}`)}
                        className="px-3 py-1 text-xs bg-[#7A5FFF] text-white rounded-lg hover:bg-[#6B4FEF] transition-colors"
                      >
                        Reply with AI
                      </button>
                      <button 
                        onClick={() => navigate(`/messages?fanId=${interaction.fanId}`)}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        View Full Thread
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
              onClick={() => handleTopicClick(item.topic, item.icon)}
              className="p-4 rounded-xl bg-gradient-to-br from-[#7A5FFF]/5 to-[#A689FF]/5 border border-[#7A5FFF]/20 hover:border-[#7A5FFF]/40 transition-colors cursor-pointer"
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-sm mb-1">{item.topic}</div>
              <div className="text-xs text-gray-600">{item.questions} questions asked</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Training Topics Modal */}
      {selectedTopic && (
        <TrainingTopicsModal
          isOpen={!!selectedTopic}
          onClose={() => setSelectedTopic(null)}
          topic={selectedTopic.topic}
          icon={selectedTopic.icon}
          questions={selectedTopic.questions}
        />
      )}
    </div>
  );
}

