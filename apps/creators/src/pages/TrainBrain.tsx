import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Mic, Check, Sparkles, MessageSquare, User, Smile, GraduationCap, BookOpen, Users } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';

interface PillarData {
  id: string;
  name: string;
  icon: any;
  color: string;
  questions: Array<{
    question: string;
    placeholder: string;
    answer: string;
  }>;
}

export default function TrainBrain() {
  const { user } = useAuth();
  const [activePillar, setActivePillar] = useState('voice');
  const [isRecording, setIsRecording] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toneSettings, setToneSettings] = useState({
    formal_casual: 75,
    calm_energetic: 85,
    gentle_blunt: 70
  });
  const [emojiBank, setEmojiBank] = useState<Array<{emoji: string, meaning: string}>>([
    { emoji: '💪', meaning: 'motivation and strength' },
    { emoji: '🔥', meaning: '' },
    { emoji: '😂', meaning: '' },
    { emoji: '👊', meaning: '' },
    { emoji: '⚡', meaning: '' }
  ]);
  const [responseStyle, setResponseStyle] = useState('Honest & Direct');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pillars: PillarData[] = [
    {
      id: 'voice',
      name: 'Voice & Personality',
      icon: User,
      color: 'from-purple-500 to-pink-500',
      questions: [
        { question: 'How would you describe your overall vibe in 3-5 words?', placeholder: 'e.g., Energetic, witty, down-to-earth...', answer: 'Energetic, motivational, straight-talking, passionate' },
        { question: 'What\'s a phrase your audience always hears you say?', placeholder: 'Your signature catchphrase...', answer: "Let's get it! No excuses, just results." },
        { question: 'If your personality was a movie character, who would it be and why?', placeholder: 'Think about tone and energy...', answer: '' },
        { question: 'How do you want people to feel after talking to you?', placeholder: 'Inspired? Informed? Entertained?...', answer: 'Pumped up and ready to take action' },
        { question: 'What\'s one thing you never want your AI to sound like?', placeholder: 'Corporate? Robotic? Too serious?...', answer: '' }
      ]
    },
    {
      id: 'humor',
      name: 'Humor & Human Touch',
      icon: Smile,
      color: 'from-yellow-500 to-orange-500',
      questions: [
        { question: 'Do you use sarcasm? If so, give an example.', placeholder: 'Share your sarcastic style...', answer: '' },
        { question: 'What kind of jokes do you make? (Self-deprecating, observational, puns?)', placeholder: 'Describe your humor...', answer: '' },
        { question: 'How do you react when someone asks something funny or absurd?', placeholder: 'Your typical response...', answer: '' },
        { question: 'Do you roast your audience playfully? Give an example.', placeholder: 'Light teasing style...', answer: '' },
        { question: 'What emojis do you use most and what do they mean to you?', placeholder: 'e.g., 💪 for motivation...', answer: '' }
      ]
    },
    {
      id: 'expertise',
      name: 'Expertise & Knowledge',
      icon: GraduationCap,
      color: 'from-blue-500 to-cyan-500',
      questions: [
        { question: 'What topics are you most knowledgeable about?', placeholder: 'Your areas of expertise...', answer: 'Fitness, nutrition, mental toughness, entrepreneurship' },
        { question: 'How do you explain complex ideas? (Simple analogies? Step-by-step? Storytelling?)', placeholder: 'Your teaching style...', answer: '' },
        { question: 'What\'s a common misconception in your field that frustrates you?', placeholder: 'Something you always correct...', answer: '' },
        { question: 'Who are your influences or mentors in your niche?', placeholder: 'People who shaped your thinking...', answer: '' },
        { question: 'What resources do you always recommend to beginners?', placeholder: 'Books, tools, courses...', answer: '' }
      ]
    },
    {
      id: 'story',
      name: 'Story & Credibility',
      icon: BookOpen,
      color: 'from-green-500 to-emerald-500',
      questions: [
        { question: 'What\'s your origin story? How did you get started?', placeholder: 'Your journey...', answer: '' },
        { question: 'What was your biggest struggle or failure?', placeholder: 'A low point that shaped you...', answer: '' },
        { question: 'What\'s your biggest achievement or proud moment?', placeholder: 'Something you overcame...', answer: '' },
        { question: 'Why do you do what you do? What drives you?', placeholder: 'Your deeper purpose...', answer: '' },
        { question: 'What do you want your legacy to be?', placeholder: 'How you want to be remembered...', answer: '' }
      ]
    },
    {
      id: 'community',
      name: 'Community & Culture',
      icon: Users,
      color: 'from-pink-500 to-rose-500',
      questions: [
        { question: 'What do you call your community? (Fans, squad, tribe?)', placeholder: 'Your community name...', answer: '' },
        { question: 'What values does your community share?', placeholder: 'Core beliefs...', answer: '' },
        { question: 'What\'s an inside joke only your audience would get?', placeholder: 'Community meme or reference...', answer: '' },
        { question: 'How do you celebrate wins with your fans?', placeholder: 'Your celebration style...', answer: '' },
        { question: 'What boundaries do you set with your audience?', placeholder: 'Topics you don\'t discuss...', answer: '' }
      ]
    }
  ];

  const [pillarData, setPillarData] = useState(pillars);

  // Map pillar IDs to database column names
  const pillarToColumnMap: Record<string, string> = {
    'voice': 'voice_personality',
    'humor': 'humor_human_touch',
    'expertise': 'expertise_knowledge',
    'story': 'story_credibility',
    'community': 'community_culture'
  };

  // Load training data from database
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadTrainingData = async () => {
      try {
        const { data, error } = await supabase
          .from('creator_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading training data:', error);
          setLoading(false);
          return;
        }

        if (data) {
          // Load pillar data
          const updatedPillars = pillars.map(pillar => {
            const columnName = pillarToColumnMap[pillar.id];
            const savedData = data[columnName] as Array<{question: string, placeholder: string, answer: string}> | null;
            
            if (savedData && savedData.length > 0) {
              return {
                ...pillar,
                questions: savedData
              };
            }
            return pillar;
          });
          setPillarData(updatedPillars);

          // Load tone settings
          if (data.tone_settings) {
            setToneSettings({
              formal_casual: data.tone_settings.formal_casual ?? 75,
              calm_energetic: data.tone_settings.calm_energetic ?? 85,
              gentle_blunt: data.tone_settings.gentle_blunt ?? 70
            });
          }

          // Load emoji bank
          if (data.emoji_bank && Array.isArray(data.emoji_bank)) {
            const loadedEmojis = [...data.emoji_bank];
            // Ensure we have 5 slots
            while (loadedEmojis.length < 5) {
              loadedEmojis.push({ emoji: '', meaning: '' });
            }
            setEmojiBank(loadedEmojis.slice(0, 5));
          }

          // Load response style
          if (data.response_style) {
            setResponseStyle(data.response_style);
          }
        }
      } catch (error) {
        console.error('Error loading training data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrainingData();
  }, [user?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save function with debouncing
  const saveToDatabase = async (debounceMs: number = 1000) => {
    if (!user?.id) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        // Calculate progress
        const totalProgress = pillarData.reduce((sum, pillar) => {
          return sum + pillar.questions.filter(q => q.answer.trim()).length;
        }, 0);
        const totalQuestions = pillarData.length * 5;
        const completionPercentage = Math.round((totalProgress / totalQuestions) * 100);

        // Prepare update object with all pillars
        const updateData: any = {
          voice_personality: pillarData.find(p => p.id === 'voice')?.questions.map(q => ({
            question: q.question,
            placeholder: q.placeholder,
            answer: q.answer
          })) || [],
          humor_human_touch: pillarData.find(p => p.id === 'humor')?.questions.map(q => ({
            question: q.question,
            placeholder: q.placeholder,
            answer: q.answer
          })) || [],
          expertise_knowledge: pillarData.find(p => p.id === 'expertise')?.questions.map(q => ({
            question: q.question,
            placeholder: q.placeholder,
            answer: q.answer
          })) || [],
          story_credibility: pillarData.find(p => p.id === 'story')?.questions.map(q => ({
            question: q.question,
            placeholder: q.placeholder,
            answer: q.answer
          })) || [],
          community_culture: pillarData.find(p => p.id === 'community')?.questions.map(q => ({
            question: q.question,
            placeholder: q.placeholder,
            answer: q.answer
          })) || [],
          tone_settings: toneSettings,
          emoji_bank: emojiBank,
          response_style: responseStyle,
          training_completion_percentage: completionPercentage
        };

        // Update training_completed_at if 100% complete
        if (completionPercentage === 100) {
          updateData.training_completed_at = new Date().toISOString();
        }

        // Check if profile exists
        const { data: existing } = await supabase
          .from('creator_profiles')
          .select('id, training_completed_at')
          .eq('id', user.id)
          .single();

        if (existing) {
          // Only update training_completed_at if it's not already set
          if (completionPercentage === 100 && existing.training_completed_at) {
            delete updateData.training_completed_at;
          }
          
          // Update existing profile
          const { error } = await supabase
            .from('creator_profiles')
            .update(updateData)
            .eq('id', user.id);

          if (error) throw error;
        } else {
          // Create new profile
          const { error } = await supabase
            .from('creator_profiles')
            .insert({
              id: user.id,
              ...updateData
            });

          if (error) throw error;
        }
      } catch (error) {
        console.error('Error saving training data:', error);
      } finally {
        setSaving(false);
        saveTimeoutRef.current = null;
      }
    }, debounceMs);
  };

  const activePillarData = pillarData.find(p => p.id === activePillar) || pillarData[0];
  const answeredCount = activePillarData.questions.filter(q => q.answer.trim()).length;
  const totalProgress = pillarData.reduce((sum, pillar) => {
    return sum + pillar.questions.filter(q => q.answer.trim()).length;
  }, 0);
  const totalQuestions = pillarData.length * 5;
  const overallProgress = Math.round((totalProgress / totalQuestions) * 100);

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setPillarData(prev => prev.map(pillar => {
      if (pillar.id === activePillar) {
        const newQuestions = [...pillar.questions];
        newQuestions[questionIndex] = { ...newQuestions[questionIndex], answer: value };
        return { ...pillar, questions: newQuestions };
      }
      return pillar;
    }));
    
    // Trigger save after a delay
    saveToDatabase(1000);
  };

  const handleMicClick = (index: number) => {
    setIsRecording(index);
    // Simulate recording
    setTimeout(() => {
      const sampleTranscription = "I keep things real and energetic. No sugar coating, just straight talk that gets people moving!";
      handleAnswerChange(index, sampleTranscription);
      setIsRecording(null);
    }, 2000);
  };

  const generateSampleReply = () => {
    const samples = [
      "Morning routine? Let's go! I kick off every day with a 20-min workout, cold shower, and black coffee. No excuses. It's all about discipline, not waiting for motivation to show up! 💪",
      "Best camera for beginners? Honestly, start with what you have - your phone! Perfect is the enemy of done. Film 10 videos with your phone before dropping $1k on gear. Trust me on this one 📹",
      "Feeling unmotivated? I get it. Here's what works for me: break it down into tiny wins. Don't think about the whole mountain, just take the next step. You got this! 🔥"
    ];
    setTestMessage(samples[Math.floor(Math.random() * samples.length)]);
  };

  const handleToneChange = (key: keyof typeof toneSettings, value: number[]) => {
    setToneSettings(prev => ({
      ...prev,
      [key]: value[0]
    }));
    saveToDatabase(1000);
  };

  const handleEmojiChange = (index: number, field: 'emoji' | 'meaning', value: string) => {
    setEmojiBank(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    saveToDatabase(1000);
  };

  const handleResponseStyleChange = (style: string) => {
    setResponseStyle(style);
    saveToDatabase(500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading training data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pillar Selection Cards */}
      <div className="grid grid-cols-5 gap-4">
        {pillarData.map((pillar) => {
          const pillarAnswered = pillar.questions.filter(q => q.answer.trim()).length;
          const isActive = activePillar === pillar.id;
          const IconComponent = pillar.icon;
          
          return (
            <button
              key={pillar.id}
              onClick={() => setActivePillar(pillar.id)}
              className={`p-4 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? `bg-gradient-to-br ${pillar.color} text-white shadow-lg scale-105`
                  : 'bg-white border-2 border-gray-200 hover:border-[#7A5FFF] hover:shadow-md'
              }`}
            >
              <div className="mb-2 flex items-center justify-center">
                <IconComponent className="w-8 h-8" />
              </div>
              <div className={`text-sm mb-2 ${isActive ? 'text-white' : 'text-gray-900'}`}>
                {pillar.name}
              </div>
              <div className={`text-xs ${isActive ? 'text-white/90' : 'text-gray-500'}`}>
                {pillarAnswered}/5 answered
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Questions Panel */}
        <div className="col-span-2 space-y-4">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activePillarData.color} flex items-center justify-center text-white`}>
                  {(() => {
                    const IconComponent = activePillarData.icon;
                    return <IconComponent className="w-6 h-6" />;
                  })()}
                </div>
                <div>
                  <h2>{activePillarData.name}</h2>
                  <div className="text-sm text-gray-600">
                    {answeredCount} of 5 questions answered
                  </div>
                </div>
              </div>
              <Badge className="bg-[#7A5FFF]/10 text-[#7A5FFF]">
                {Math.round((answeredCount / 5) * 100)}% Complete
              </Badge>
            </div>

            <div className="space-y-4">
              {activePillarData.questions.map((q, index) => (
                <Card key={index} className="p-4 bg-[#F9F9F9] rounded-xl border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm text-gray-700 mb-3">{q.question}</div>
                      <div className="relative">
                        <textarea
                          value={q.answer}
                          onChange={(e) => handleAnswerChange(index, e.target.value)}
                          placeholder={q.placeholder}
                          rows={3}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF] resize-none"
                        />
                        <button
                          onClick={() => handleMicClick(index)}
                          className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                            isRecording === index
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-gray-100 text-gray-600 hover:bg-[#7A5FFF] hover:text-white'
                          }`}
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      </div>
                      {isRecording === index && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                          <div className="flex gap-1">
                            <div className="w-1 h-3 bg-red-600 rounded animate-pulse"></div>
                            <div className="w-1 h-4 bg-red-600 rounded animate-pulse delay-75"></div>
                            <div className="w-1 h-3 bg-red-600 rounded animate-pulse delay-150"></div>
                          </div>
                          <span>Listening…</span>
                        </div>
                      )}
                    </div>
                    {q.answer.trim() && (
                      <div className="ml-3 mt-1">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Tone Customization Panel */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <h3 className="mb-4">Tone Customization</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-600 mb-3">Tone Sliders</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Formal</span>
                      <span>Casual</span>
                    </div>
                    <Slider 
                      value={[toneSettings.formal_casual]} 
                      onChange={(value: number[]) => handleToneChange('formal_casual', value)}
                      max={100} 
                      className="w-full" 
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Calm</span>
                      <span>Energetic</span>
                    </div>
                    <Slider 
                      value={[toneSettings.calm_energetic]} 
                      onChange={(value: number[]) => handleToneChange('calm_energetic', value)}
                      max={100} 
                      className="w-full" 
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Gentle</span>
                      <span>Blunt</span>
                    </div>
                    <Slider 
                      value={[toneSettings.gentle_blunt]} 
                      onChange={(value: number[]) => handleToneChange('gentle_blunt', value)}
                      max={100} 
                      className="w-full" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-3">Emoji Bank</label>
                <div className="text-sm text-gray-500 mb-3">Add your top 5 emojis and what you use them for</div>
                <div className="space-y-2">
                  {emojiBank.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item.emoji}
                        onChange={(e) => handleEmojiChange(index, 'emoji', e.target.value)}
                        placeholder="Emoji"
                        maxLength={2}
                        className="w-10 h-10 bg-[#F9F9F9] rounded-lg flex items-center justify-center text-xl text-center"
                      />
                      <input
                        type="text"
                        value={item.meaning}
                        onChange={(e) => handleEmojiChange(index, 'meaning', e.target.value)}
                        placeholder={index === 0 ? "e.g., when motivating or showing strength" : "What does this emoji mean to you?"}
                        className="flex-1 px-3 py-2 bg-[#F9F9F9] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-3">Response Style</label>
                <div className="text-sm text-gray-500 mb-3">How do you respond to heavy or emotional questions?</div>
                <div className="grid grid-cols-2 gap-3">
                  {['Comforting', 'Honest & Direct', 'Humorous', 'Private Boundary'].map((style) => (
                    <button
                      key={style}
                      onClick={() => handleResponseStyleChange(style)}
                      className={`px-4 py-3 rounded-xl text-sm transition-colors ${
                        style === responseStyle
                          ? 'bg-[#7A5FFF] text-white'
                          : 'bg-[#F9F9F9] text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Preview Panel */}
        <div className="space-y-4">
          <Card className="p-4 bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] text-white rounded-xl border-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <div className="text-lg">Live Preview</div>
              {saving && (
                <div className="ml-auto text-xs opacity-75">Saving...</div>
              )}
            </div>
            <div className="text-sm opacity-90">Test how your AI sounds</div>
          </Card>

          <Card className="p-4 bg-white rounded-xl shadow-sm border-0">
            <div className="text-sm text-gray-600 mb-2">Current tone detected</div>
            <div className="text-lg text-[#7A5FFF] mb-4">Friendly + Energetic</div>
            
            <div className="bg-[#F9F9F9] rounded-xl p-4 min-h-[300px] max-h-[400px] overflow-y-auto mb-4">
              {testMessage ? (
                <div className="bg-white rounded-lg p-3 text-sm text-gray-700 shadow-sm">
                  {testMessage}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  Generate a sample reply to test your AI's tone
                </div>
              )}
            </div>

            <Button
              onClick={generateSampleReply}
              className="w-full bg-[#7A5FFF] hover:bg-[#6B4FEF] text-white rounded-xl mb-4"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Generate Sample Reply
            </Button>

            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Training Completion</div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-gradient-to-r from-[#7A5FFF] to-[#A689FF] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{totalProgress} / {totalQuestions} questions</span>
                <span className="text-[#7A5FFF]">{overallProgress}%</span>
              </div>
            </div>

            {overallProgress === 100 && (
              <div className="mt-4 p-4 bg-gradient-to-r from-[#7A5FFF]/10 to-[#A689FF]/10 rounded-xl border border-[#7A5FFF]/30">
                <div className="text-center mb-3">
                  <div className="text-3xl mb-2">🎉</div>
                  <div className="text-sm">Your Creator Brain is ready for fans!</div>
                </div>
                <Button className="w-full bg-gradient-to-r from-[#7A5FFF] to-[#A689FF] text-white rounded-xl">
                  Preview Brain
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-4 bg-white rounded-xl shadow-sm border-0">
            <div className="text-sm text-gray-600 mb-3">Pillar Progress</div>
            <div className="space-y-2">
              {pillarData.map((pillar) => {
                const answered = pillar.questions.filter(q => q.answer.trim()).length;
                const progress = (answered / 5) * 100;
                const IconComponent = pillar.icon;
                
                return (
                  <div key={pillar.id}>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span className="flex items-center gap-1">
                        <IconComponent className="w-3 h-3" />
                        <span>{pillar.name}</span>
                      </span>
                      <span>{answered}/5</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`bg-gradient-to-r ${pillar.color} h-1.5 rounded-full transition-all duration-300`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

