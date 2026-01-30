'use client';

export default function Legend() {
  const items = [
    { color: '#22c55e', bars: '█░░░░░', label: '< 12K', threat: 'LOW' },
    { color: '#84cc16', bars: '██░░░░', label: '12-14K', threat: 'MODERATE' },
    { color: '#eab308', bars: '███░░░', label: '14-16K', threat: 'ELEVATED' },
    { color: '#f97316', bars: '████░░', label: '16-18K', threat: 'HIGH' },
    { color: '#ef4444', bars: '█████░', label: '18-22K', threat: 'SEVERE' },
    { color: '#dc2626', bars: '██████', label: '> 22K', threat: 'CRITICAL' },
  ];

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-3 group">
          <span
            className="font-mono text-xs tracking-wider"
            style={{ color: item.color }}
          >
            {item.bars}
          </span>
          <span className="font-mono text-xs text-gray-400 flex-1">{item.label}</span>
          <span
            className="font-mono text-[10px] opacity-70"
            style={{ color: item.color }}
          >
            {item.threat}
          </span>
        </div>
      ))}
      <div className="pt-2 mt-2 border-t border-[#00d4aa10]">
        <p className="font-mono text-[10px] text-gray-600">PLN/M² PRICE INDEX</p>
      </div>
    </div>
  );
}
