export function ClientFilter({ companies, activeClient, onSelect }) {
  return (
    <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-surface-300 bg-white flex-shrink-0">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all ${
          !activeClient
            ? 'bg-navy-900 text-white border-navy-900'
            : 'text-navy-500 border-surface-300 hover:border-navy-400 hover:text-navy-700'
        }`}
      >
        All
      </button>
      {companies.map(co => (
        <button
          key={co.id}
          onClick={() => onSelect(activeClient === co.id ? null : co.id)}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-display font-semibold px-3 py-1.5 rounded-full border transition-all ${
            activeClient === co.id ? 'text-white' : 'hover:opacity-80'
          }`}
          style={
            activeClient === co.id
              ? { backgroundColor: co.color, borderColor: co.color }
              : { backgroundColor: `${co.color}15`, borderColor: `${co.color}40`, color: co.color }
          }
        >
          <span>{co.emoji}</span>
          <span>{co.name}</span>
        </button>
      ))}
    </div>
  )
}
