import { useState, useEffect } from 'react';
import type { ConversationNode } from '../../lib/types';
import OptionGrid from './OptionGrid';
import TextInput from './TextInput';
import SpecialtyReferral from './SpecialtyReferral';
import type { SpecialtyReferral as SpecialtyReferralType } from '../../lib/types';

interface QuestionCardProps {
  node: ConversationNode;
  onAnswer: (answer: string | string[]) => void;
  validationError: string | null;
  canGoBack: boolean;
  onBack: () => void;
  specialtyReferrals?: SpecialtyReferralType[];
}

const QuestionCard = ({
  node,
  onAnswer,
  validationError,
  canGoBack,
  onBack,
  specialtyReferrals,
}: QuestionCardProps) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in');

  useEffect(() => {
    setSelected([]);
    setSlideDirection('in');
  }, [node.id]);

  const handleSelect = (value: string) => {
    if (value === '__confirm__') {
      onAnswer(selected);
      return;
    }

    if (node.inputType === 'multiselect') {
      // Toggle for multiselect, but "none/skip" clears everything else
      if (value === 'none' || value === 'skip') {
        setSelected([value]);
        return;
      }
      setSelected((prev) => {
        const filtered = prev.filter((v) => v !== 'none' && v !== 'skip');
        return filtered.includes(value)
          ? filtered.filter((v) => v !== value)
          : [...filtered, value];
      });
    } else {
      // Single select - immediately advance
      onAnswer(value);
    }
  };

  const handleTextSubmit = (value: string) => {
    onAnswer(value);
  };

  const isTextInput = ['text', 'number', 'email', 'tel', 'zip'].includes(node.inputType);
  const showReferrals = node.id === 'specialty_warning' && specialtyReferrals && specialtyReferrals.length > 0;

  return (
    <div className={`estimator-question-card slide-${slideDirection}`}>
      {canGoBack && (
        <button className="estimator-back-btn" onClick={onBack} type="button">
          &larr; Back
        </button>
      )}

      <h3 className="estimator-question">{node.question}</h3>
      {node.subtext && <p className="estimator-subtext">{node.subtext}</p>}

      {showReferrals && <SpecialtyReferral referrals={specialtyReferrals!} />}

      {isTextInput ? (
        <TextInput
          inputType={node.inputType}
          placeholder={node.placeholder}
          onSubmit={handleTextSubmit}
          error={validationError}
        />
      ) : (
        node.options && (
          <OptionGrid
            options={node.options}
            selected={selected}
            multiSelect={node.inputType === 'multiselect'}
            onSelect={handleSelect}
          />
        )
      )}
    </div>
  );
};

export default QuestionCard;
