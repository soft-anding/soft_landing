'use client';

import { useState } from 'react';
import { Question } from '@/lib/profile-questions';

interface ConversationScreenProps {
  question: Question;
  onAnswer: (answer: unknown) => void;
}

export default function ConversationScreen({ question, onAnswer }: ConversationScreenProps) {
  const [answer, setAnswer] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleSubmit = () => {
    if (question.type === 'checkbox') {
      onAnswer(selectedOptions);
    } else if (answer.trim() || !question.required) {
      onAnswer(answer);
    }
  };

  const handleToggleCheckbox = (value: string) => {
    setSelectedOptions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const isAnswered = () => {
    if (question.type === 'checkbox') {
      return selectedOptions.length > 0;
    }
    if (question.type === 'consent') {
      return answer === 'true' || answer === true;
    }
    return answer.trim().length > 0;
  };

  return (
    <div className="flex-1 flex items-center justify-center p-md">
      <div className="w-full max-w-lg">
        {/* Question */}
        <div className="mb-lg">
          <h1 className="text-3xl font-bold text-text-primary leading-tight">{question.text}</h1>
        </div>

        {/* Answer options */}
        <div className="space-y-md">
          {question.type === 'select' && question.options && (
            <div className="space-y-sm">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAnswer(option.value)}
                  className={`w-full p-md rounded-lg border-2 text-right font-medium transition-all ${
                    answer === option.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-surface-300 bg-white text-text-primary hover:border-primary-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {question.type === 'text' && (
            <input
              type="text"
              placeholder={question.placeholder || 'הקלד תשובה...'}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isAnswered()) {
                  handleSubmit();
                }
              }}
              className="w-full p-md rounded-lg border-2 border-surface-300 bg-white text-text-primary placeholder-text-secondary focus:border-primary-500 focus:outline-none text-right"
              dir="rtl"
            />
          )}

          {question.type === 'date' && (
            <input
              type="date"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full p-md rounded-lg border-2 border-surface-300 bg-white text-text-primary focus:border-primary-500 focus:outline-none"
            />
          )}

          {question.type === 'checkbox' && question.options && (
            <div className="space-y-sm">
              {question.options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-md p-md rounded-lg border-2 border-surface-300 bg-white cursor-pointer hover:border-primary-300 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option.value)}
                    onChange={() => handleToggleCheckbox(option.value)}
                    className="w-5 h-5 rounded cursor-pointer accent-primary-500"
                  />
                  <span className="text-right flex-1 text-text-primary">{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {question.type === 'consent' && (
            <button
              onClick={() => setAnswer(answer === 'true' ? '' : 'true')}
              className={`w-full p-md rounded-lg border-2 text-right font-medium transition-all ${
                answer === 'true'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-surface-300 bg-white text-text-primary hover:border-primary-300'
              }`}
            >
              {answer === 'true' ? '✓ הסכמתי' : 'אני מסכים/ה לבדיקת זכאות'}
            </button>
          )}
        </div>

        {/* Submit button */}
        <div className="mt-lg">
          <button
            onClick={handleSubmit}
            disabled={!isAnswered() && question.required}
            className="w-full p-md rounded-full bg-primary-500 text-white font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600"
          >
            המשך
          </button>
        </div>
      </div>
    </div>
  );
}
