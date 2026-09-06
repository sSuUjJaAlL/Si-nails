export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
