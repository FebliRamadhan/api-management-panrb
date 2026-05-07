export default function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg bg-surface2 border border-white/10 cursor-pointer"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1 font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
