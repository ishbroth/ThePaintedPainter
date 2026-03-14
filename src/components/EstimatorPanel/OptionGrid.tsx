import type { ConversationOption } from '../../lib/types';
import OptionButton from './OptionButton';

interface OptionGridProps {
  options: ConversationOption[];
  selected: string[];
  multiSelect: boolean;
  onSelect: (value: string) => void;
}

const OptionGrid = ({ options, selected, multiSelect, onSelect }: OptionGridProps) => {
  const isSingleColumn = options.length <= 3;

  return (
    <div className={`estimator-option-grid ${isSingleColumn ? 'single-col' : ''}`}>
      {options.map((option) => (
        <OptionButton
          key={option.value}
          label={option.label}
          selected={selected.includes(option.value)}
          onClick={() => onSelect(option.value)}
        />
      ))}
      {multiSelect && selected.length > 0 && (
        <button
          className="estimator-confirm-btn"
          onClick={() => onSelect('__confirm__')}
          type="button"
        >
          Continue with {selected.length} selected
        </button>
      )}
    </div>
  );
};

export default OptionGrid;
