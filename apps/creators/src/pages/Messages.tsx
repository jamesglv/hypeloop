import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  content: string;
  role: 'fan' | 'ai';
  created_at: string;
  fan_id?: string;
  creator_id?: string;
}

interface Fan {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface ChatHistory {
  fanId: string;
  lastMessage: string;
  timestamp: Date;
  fan: Fan;
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fanIdParam = searchParams.get('fanId');
  
  const [activeFanId, setActiveFanId] = useState<string | null>(fanIdParam || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [activeFan, setActiveFan] = useState<Fan | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat history (fans who have messaged this creator)
  useEffect(() => {
    if (!user?.id) return;

    const fetchChatHistory = async () => {
      // Get all messages for this creator, ordered by created_at
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('fan_id, content, created_at, role')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return;
      }

      if (!messagesData || messagesData.length === 0) {
        setChatHistory([]);
        return;
      }

      // Group by fan_id and get latest message for each fan
      const fanMap = new Map<string, { lastMessage: string; timestamp: Date }>();
      
      messagesData.forEach((msg) => {
        const fanId = msg.fan_id;
        if (!fanMap.has(fanId)) {
          fanMap.set(fanId, {
            lastMessage: msg.content,
            timestamp: new Date(msg.created_at),
          });
        }
      });

      const fanIds = Array.from(fanMap.keys());

      // Fetch fan details
      const { data: fansData, error: fansError } = await supabase
        .from('fans')
        .select('id, display_name, username')
        .in('id', fanIds);

      if (fansError) {
        console.error('Error fetching fans:', fansError);
        return;
      }

      const history: ChatHistory[] = fanIds.map((fanId) => {
        const fanData = fansData?.find((f) => f.id === fanId);
        const chatData = fanMap.get(fanId)!;

        return {
          fanId,
          lastMessage: chatData.lastMessage,
          timestamp: chatData.timestamp,
          fan: {
            id: fanId,
            display_name: fanData?.display_name || null,
            username: fanData?.username || null,
          },
        };
      }).sort((a, b) => {
        // Sort by timestamp (most recent first)
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      setChatHistory(history);
    };

    fetchChatHistory();
  }, [user]);

  // Update URL when activeFanId changes
  useEffect(() => {
    if (activeFanId) {
      setSearchParams({ fanId: activeFanId });
    } else {
      setSearchParams({});
    }
  }, [activeFanId, setSearchParams]);

  // Set active fan from URL param on mount
  useEffect(() => {
    if (fanIdParam && chatHistory.length > 0) {
      const fan = chatHistory.find(h => h.fanId === fanIdParam);
      if (fan) {
        setActiveFanId(fanIdParam);
        setActiveFan(fan.fan);
      }
    }
  }, [fanIdParam, chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages when active fan changes
  useEffect(() => {
    if (activeFanId && user?.id) {
      fetchMessages();
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`creator-messages:${user.id}:${activeFanId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `creator_id=eq.${user.id}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;
            if (newMessage.fan_id === activeFanId) {
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
  }, [activeFanId, user]);

  const fetchMessages = async () => {
    if (!activeFanId || !user?.id) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('fan_id', activeFanId)
      .eq('creator_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else if (data) {
      setMessages(data);
    }
  };

  const handleGenerateAI = async () => {
    if (!activeFanId || !user || loading) return;

    setLoading(true);

    try {
      // Get subscription ID for this fan
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('fan_id', activeFanId)
        .eq('creator_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      // Prepare conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // If there's input, use it. Otherwise, use the last fan message or a default prompt
      let messageContent = inputValue.trim();
      if (!messageContent) {
        // Find the last fan message
        const lastFanMessage = [...messages].reverse().find(msg => msg.role === 'fan');
        if (lastFanMessage) {
          messageContent = lastFanMessage.content;
        } else {
          // If no fan messages, use a default prompt
          messageContent = "Hello!";
        }
      }

      // Call edge function to generate AI response
      // Set skip_save=true so it only generates text without saving to database
      let responseData;
      let responseError;
      let errorResponseBody = null;
      
      try {
        const result = await supabase.functions.invoke(
          'generate-ai-response',
          {
            body: {
              fan_id: activeFanId,
              creator_id: user.id,
              subscription_id: subscription?.id,
              message_content: messageContent,
              conversation_history: conversationHistory,
              skip_save: true, // Don't save messages, just generate text
            },
          }
        );
        
        responseData = result.data;
        responseError = result.error;
        
        // If there's an error, try to manually fetch the error response
        if (responseError) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const session = sessionData?.session;
            
            const errorResponse = await fetch(
              'https://uirdgypveetgohptzxiw.supabase.co/functions/v1/generate-ai-response',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpcmRneXB2ZWV0Z29ocHR6eGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODkwNTMsImV4cCI6MjA3Nzk2NTA1M30.8-Wnslvj8erg1M5OLjsOc7FYQPY5YMFO5ycbLQI8DRs'}`,
                },
                body: JSON.stringify({
                  fan_id: activeFanId,
                  creator_id: user.id,
                  subscription_id: subscription?.id,
                  message_content: messageContent,
                  conversation_history: conversationHistory,
                  skip_save: true,
                }),
              }
            );
            
            if (!errorResponse.ok) {
              const errorText = await errorResponse.text();
              console.log('Raw error response:', errorText);
              try {
                errorResponseBody = JSON.parse(errorText);
              } catch {
                errorResponseBody = { raw: errorText };
              }
            }
          } catch (fetchErr) {
            console.error('Error fetching error response:', fetchErr);
          }
        }
      } catch (err) {
        console.error('Exception calling edge function:', err);
        responseError = err;
      }

      if (responseError) {
        console.error('Error generating AI response:', responseError);
        console.error('Full error object:', JSON.stringify(responseError, null, 2));
        console.error('Error response body:', errorResponseBody);
        
        // Try to get more details from the error
        let errorDetails = 'Unknown error';
        let errorMessage = responseError.message || 'Unknown error';
        
        // First, try to get error from the manually fetched response body
        if (errorResponseBody) {
          errorDetails = errorResponseBody.details || errorResponseBody.error || errorResponseBody.message || JSON.stringify(errorResponseBody);
          console.log('Using error from response body:', errorDetails);
        }
        
        // Try to extract error details from the response
        try {
          // Check if there's a response object we can read
          if (responseError.context && typeof responseError.context === 'object') {
            // Try to get the response body
            if ('status' in responseError.context) {
              console.log('Error has status:', responseError.context.status);
            }
          }
          
          // Also check if the error has a data property
          if (responseError.data && !errorResponseBody) {
            console.log('Error data:', responseError.data);
            if (typeof responseError.data === 'string') {
              try {
                const errorJson = JSON.parse(responseError.data);
                errorDetails = errorJson.details || errorJson.error || errorJson.message || responseError.data;
              } catch {
                errorDetails = responseError.data;
              }
            } else if (typeof responseError.data === 'object') {
              errorDetails = responseError.data.details || responseError.data.error || responseError.data.message || JSON.stringify(responseError.data);
            }
          }
          
          // Check error message
          if (responseError.message && responseError.message !== 'Edge Function returned a non-2xx status code') {
            errorMessage = responseError.message;
          }
        } catch (e) {
          console.error('Error parsing error details:', e);
        }
        
        console.error('Error details:', errorDetails);
        console.error('Error message:', errorMessage);
        
        // Show user-friendly error message
        let userMessage = 'Failed to generate AI response. ';
        const fullError = errorDetails || errorMessage;
        
        if (fullError.includes('insufficient_quota') || fullError.includes('exceeded your current quota')) {
          userMessage += 'OpenAI API quota exceeded. Please add credits to your OpenAI account at https://platform.openai.com/account/billing';
        } else if (fullError.includes('API key') || fullError.includes('not configured')) {
          userMessage += 'OpenAI API key is not configured. Please check Supabase secrets.';
        } else if (fullError.includes('rate limit') || fullError.includes('429')) {
          userMessage += 'API rate limit exceeded. Please try again later.';
        } else if (fullError.includes('invalid') || fullError.includes('401') || fullError.includes('403')) {
          userMessage += 'Invalid API key or configuration. Please check your OpenAI API key.';
        } else if (fullError.includes('model') || fullError.includes('not found')) {
          userMessage += 'Model not available. Please check configuration.';
        } else {
          userMessage += `Error: ${fullError.substring(0, 150)}. Check console and Supabase dashboard logs for details.`;
        }
        
        alert(userMessage);
        
        setLoading(false);
        return;
      }

      // Fill the input field with the generated response
      if (responseData?.response) {
        setInputValue(responseData.response);
      } else {
        console.error('No response in data:', responseData);
        alert('Generated response was empty. Please try again.');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error generating AI response:', error);
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeFanId || !user || loading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      // Get subscription ID for this fan
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('fan_id', activeFanId)
        .eq('creator_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      // Insert message directly as creator response (manual message)
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          fan_id: activeFanId,
          creator_id: user.id,
          subscription_id: subscription?.id || null,
          content: messageContent,
          role: 'ai',
          is_ai_generated: false, // Manual message, not AI generated
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        setInputValue(messageContent); // Restore message on error
        setLoading(false);
        return;
      }

      // Don't manually add to state - let realtime subscription handle it
      // This prevents duplicate messages
      setLoading(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setLoading(false);
    }
  };


  const formatTime = (date: Date) => {
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

  const getInitials = (fan: Fan): string => {
    const name = fan.display_name || fan.username || 'Fan';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleChatSelect = (fanId: string) => {
    setActiveFanId(fanId);
    const chat = chatHistory.find(h => h.fanId === fanId);
    if (chat) {
      setActiveFan(chat.fan);
    }
  };

  const getFanName = (fan: Fan): string => {
    return fan.display_name || fan.username || 'Fan';
  };

  return (
    <div className="h-full flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Chat History Sidebar */}
      <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="px-5 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#7A5FFF]" />
            <h3 className="text-gray-900 font-medium">Messages</h3>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chatHistory.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No messages yet
            </div>
          ) : (
            chatHistory.map((chat) => {
              const isActive = activeFanId === chat.fanId;

              return (
                <button
                  key={chat.fanId}
                  onClick={() => handleChatSelect(chat.fanId)}
                  className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 
                            transition-colors border-l-2 ${
                    isActive 
                      ? 'border-[#7A5FFF] bg-[#7A5FFF]/5' 
                      : 'border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white">
                      {getInitials(chat.fan)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={`text-sm ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                        {getFanName(chat.fan)}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {formatTime(chat.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">
                      {chat.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!activeFan ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p>Select a fan to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white">
                {getInitials(activeFan)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 font-medium">{getFanName(activeFan)}</div>
                <div className="text-gray-500 text-sm">Fan conversation</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={message.id || `msg-${index}-${message.created_at}`}
                    className={`flex ${message.role === 'fan' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      style={{
                        backgroundColor: message.role === 'fan' ? '#FFFFFF' : '#7A5FFF',
                      }}
                      className={`max-w-[75%] px-4 py-3 rounded-[18px] ${
                        message.role === 'fan'
                          ? 'text-gray-900 border border-gray-200'
                          : 'text-white'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-end">
                    <div
                      style={{ backgroundColor: '#7A5FFF' }}
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
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(); // Manual send by default on Enter
                      }
                    }}
                    placeholder="Type a message or use 'Generate AI' to create a response..."
                    className="flex-1 px-4 py-3 rounded-[14px] bg-gray-50 border border-gray-200 
                             focus:outline-none focus:ring-2 focus:ring-[#7A5FFF] transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={loading}
                  />
                  <button
                    onClick={handleGenerateAI}
                    disabled={loading}
                    style={{ backgroundColor: '#7A5FFF' }}
                    className="px-4 py-2 rounded-[14px] text-white disabled:opacity-40 
                             transition-opacity hover:opacity-90 text-sm font-medium"
                    title="Generate AI response using your training"
                  >
                    Generate AI
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || loading}
                    className="px-4 py-3 rounded-[14px] bg-gray-600 text-white disabled:opacity-40 
                             transition-opacity hover:opacity-90"
                    title="Send manual message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Click "Generate AI" to create a response (even with empty field), then edit and send manually
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

