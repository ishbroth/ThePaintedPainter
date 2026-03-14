interface OptionButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

const OptionButton = ({ label, selected, onClick }: OptionButtonProps) => {
  return (
    <button
      className={`estimator-option-btn ${selected ? 'selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
};

export default OptionButton;
