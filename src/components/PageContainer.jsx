// Centered, max-width column for reading views.
// Keeps content scannable instead of stretching edge-to-edge.
export function PageContainer({ children, width = 'narrow', className = '' }) {
  const maxW = width === 'wide' ? 'max-w-5xl' : width === 'medium' ? 'max-w-3xl' : 'max-w-2xl'
  return (
    <div className="h-full overflow-y-auto">
      <div className={`${maxW} mx-auto w-full px-4 ${className}`}>
        {children}
      </div>
    </div>
  )
}
