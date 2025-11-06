import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';
import type { Creator } from './Home';

interface Message {
  id: string;
  content: string;
  role: 'fan' | 'ai';
  created_at: string;
  fan_id?: string;
  creator_id?: string;
}

interface ChatHistory {
  creatorId: string;
  lastMessage: string;
  timestamp: Date;
  creator: Creator;
}

interface ChatInterfaceProps {
  selectedCreator: Creator | null;
  onSelectCreator: (creator: Creator | null) => void;
}

export function ChatInterface({ selectedCreator, onSelectCreator }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [activeCreatorId, setActiveCreatorId] = useState<string | null>(selectedCreator?.id || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat history (creators user has messaged)
  useEffect(() => {
    if (!user) return;

    const fetchChatHistory = async () => {
      // Get unique creator IDs from messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('creator_id, content, created_at')
        .eq('fan_id', user.id)
        .order('created_at', { ascending: false });

      if (!messagesData || messagesData.length === 0) return;

      // Group by creator and get latest message
      const creatorMap = new Map<string, { lastMessage: string; timestamp: Date }>();
      
      messagesData.forEach((msg) => {
        const creatorId = msg.creator_id;
        if (!creatorMap.has(creatorId)) {
          creatorMap.set(creatorId, {
            lastMessage: msg.content,
            timestamp: new Date(msg.created_at),
          });
        }
      });

      const creatorIds = Array.from(creatorMap.keys());

      // Fetch creator details
      const { data: creatorsData } = await supabase
        .from('creators')
        .select('id, display_name, username, bio')
        .in('id', creatorIds);

      const { data: profilesData } = await supabase
        .from('creator_profiles')
        .select('id, niche, profile_picture_url')
        .in('id', creatorIds);

      const history: ChatHistory[] = creatorIds.map((creatorId) => {
        const creatorData = creatorsData?.find((c) => c.id === creatorId);
        const profile = profilesData?.find((p) => p.id === creatorId);
        const chatData = creatorMap.get(creatorId)!;

        const colors = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FBBF24', '#FB7185', '#34D399'];
        const colorIndex = parseInt(creatorId.slice(0, 2), 16) % colors.length;

        const creator: Creator = {
          id: creatorId,
          name: creatorData?.display_name || 'Creator',
          username: creatorData?.username || 'creator',
          tagline: creatorData?.bio || '',
          price: 4.99,
          category: profile?.niche?.[0] || 'General',
          avatar: profile?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorData?.display_name || 'Creator')}&background=random`,
          brandColor: colors[colorIndex],
        };

        return {
          creatorId,
          lastMessage: chatData.lastMessage,
          timestamp: chatData.timestamp,
          creator,
        };
      });

      setChatHistory(history);
      setCreators(history.map((h) => h.creator));
    };

    fetchChatHistory();
  }, [user]);

  const activeCreator = creators.find(c => c.id === activeCreatorId) || selectedCreator;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages and subscription when active creator changes
  useEffect(() => {
    if (activeCreatorId && user) {
      fetchSubscription();
      fetchMessages();
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`messages:${activeCreatorId}:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `creator_id=eq.${activeCreatorId}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;
            if (newMessage.fan_id === user?.id || newMessage.role === 'ai') {
              setMessages((prev) => {
                // Check if message already exists to prevent duplicates
                const exists = prev.some(msg => msg.id === newMessage.id);
                if (exists) return prev;
                return [...prev, newMessage];
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeCreatorId, user]);

  // Update active creator when selectedCreator changes
  useEffect(() => {
    if (selectedCreator) {
      setActiveCreatorId(selectedCreator.id);
    }
  }, [selectedCreator]);

  // Initialize with welcome message if no messages
  useEffect(() => {
    if (activeCreator && messages.length === 0 && !loading) {
      setMessages([
        {
          id: 'welcome',
          content: `Hey! I'm ${activeCreator.name}'s AI assistant, trained on all their content and expertise. What would you like to know?`,
          role: 'ai',
          created_at: new Date().toISOString(),
        },
      ]);
    }
  }, [activeCreator, loading]);

  const fetchSubscription = async () => {
    if (!activeCreatorId || !user) return;

    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('fan_id', user.id)
      .eq('creator_id', activeCreatorId)
      .eq('status', 'active')
      .maybeSingle();

    if (data) {
      setSubscriptionId(data.id);
    } else {
      setSubscriptionId(null);
    }
  };

  const fetchMessages = async () => {
    if (!activeCreatorId || !user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('fan_id', user.id)
      .eq('creator_id', activeCreatorId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else if (data && data.length > 0) {
      setMessages(data);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeCreatorId || !user || loading || !subscriptionId) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      // Call edge function to generate AI response
      // The edge function will insert both the fan message and AI response
      const { error: aiError } = await supabase.functions.invoke(
        'generate-ai-response',
        {
          body: {
            fan_id: user.id,
            creator_id: activeCreatorId,
            subscription_id: subscriptionId,
            message_content: messageContent,
            skip_save: false, // Explicitly set to false to ensure messages are saved
          },
        }
      );

      if (aiError) {
        console.error('Error generating AI response:', aiError);
        // Restore message on error
        setInputValue(messageContent);
      }

      // Don't need to refresh - realtime subscription will handle new messages
      setLoading(false);
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on error
      setInputValue(messageContent);
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleChatSelect = (creatorId: string) => {
    setActiveCreatorId(creatorId);
    const creator = creators.find(c => c.id === creatorId);
    if (creator) {
      onSelectCreator(creator);
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Chat History Sidebar */}
      <div className="w-[280px] bg-card border-r border-border flex flex-col">
        {/* Sidebar Header */}
        <div className="px-5 py-5 border-b border-border">
          <h3 className="text-foreground font-medium">Messages</h3>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {chatHistory.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No chat history yet
            </div>
          ) : (
            chatHistory.map((chat) => {
              const isActive = activeCreatorId === chat.creatorId;

              return (
                <motion.button
                  key={chat.creatorId}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleChatSelect(chat.creatorId)}
                  className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-accent 
                            transition-colors border-l-2 ${
                    isActive 
                      ? 'border-primary bg-accent' 
                      : 'border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={chat.creator.avatar}
                      alt={chat.creator.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={`text-sm ${isActive ? 'text-foreground font-medium' : 'text-foreground'}`}>
                        {chat.creator.name}
                      </span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {formatTime(chat.timestamp)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs truncate">
                      {chat.lastMessage}
                    </p>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!activeCreator ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a creator to start chatting</p>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div className="bg-card border-b border-border px-6 py-4 flex items-center gap-3">
              <img
                src={activeCreator.avatar}
                alt={activeCreator.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-medium">{activeCreator.name}</div>
                <div className="text-muted-foreground text-sm">@{activeCreator.username}</div>
              </div>

              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
              <div className="max-w-3xl mx-auto space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${message.role === 'fan' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        style={{
                          backgroundColor: message.role === 'fan' ? '#E5E7EB' : activeCreator.brandColor,
                        }}
                        className={`max-w-[75%] px-4 py-3 rounded-[18px] ${
                          message.role === 'fan'
                            ? 'text-foreground'
                            : 'text-white'
                        }`}
                      >
                        {message.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <div className="flex justify-start">
                    <div
                      style={{ backgroundColor: activeCreator.brandColor }}
                      className="px-4 py-3 rounded-[18px] text-white"
                    >
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Bar */}
            <div className="bg-card border-t border-border px-6 py-4 safe-area-bottom">
              <div className="max-w-3xl mx-auto">
                {subscriptionId ? (
                  <>
                    <div className="flex items-end gap-2 mb-2">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message…"
                        className="flex-1 px-4 py-3 rounded-[14px] bg-input-background border-0 
                                 focus:outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                        disabled={loading}
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSend}
                        disabled={!inputValue.trim() || loading}
                        style={{ backgroundColor: activeCreator.brandColor }}
                        className="p-3 rounded-[14px] text-white disabled:opacity-40 
                                 transition-opacity hover:opacity-90"
                      >
                        <Send className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="text-foreground mb-3">Subscribe to chat with {activeCreator.name}</div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ backgroundColor: activeCreator.brandColor }}
                      className="px-6 py-3 rounded-[14px] text-white"
                      onClick={() => {
                        // Trigger subscription modal - this would be handled by parent
                        onSelectCreator(activeCreator);
                      }}
                    >
                      Subscribe for ${activeCreator.price}/mo
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
