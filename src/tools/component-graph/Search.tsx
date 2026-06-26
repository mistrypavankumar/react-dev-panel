import { IconX, IconSearch } from '../../core/icons';

export function GraphSearch({
  value,
  onChange,
  placeholder = 'Search components…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rdp-input">
      <span style={{ color: 'var(--rdp-text-faint)', display: 'grid', placeItems: 'center' }}>
        <IconSearch size={15} />
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Search components" />
      {value && (
        <button type="button" className="rdp-iconbtn-bare" onClick={() => onChange('')} aria-label="Clear">
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
