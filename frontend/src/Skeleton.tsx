function Skeleton({ className = '', theme = 'light' }: { className?: string, theme?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} ${className}`}
    />
  )
}

export default Skeleton