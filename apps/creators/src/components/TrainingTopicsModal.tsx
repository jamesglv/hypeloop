import { X } from 'lucide-react';

interface TrainingTopicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  icon: string;
  questions: string[];
}

export function TrainingTopicsModal({ isOpen, onClose, topic, icon, questions }: TrainingTopicsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden m-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{icon}</div>
            <h2 className="text-xl font-semibold text-gray-900">{topic}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4">
            Suggested questions to help train your AI brain on this topic:
          </p>
          <div className="space-y-3">
            {questions.map((question, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-gradient-to-br from-[#7A5FFF]/5 to-[#A689FF]/5 border border-[#7A5FFF]/20 hover:border-[#7A5FFF]/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-sm font-medium text-[#7A5FFF] flex-shrink-0">
                    {index + 1}.
                  </span>
                  <span className="text-sm text-gray-700 leading-relaxed">{question}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#7A5FFF] text-white rounded-lg hover:bg-[#6B4FEF] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

