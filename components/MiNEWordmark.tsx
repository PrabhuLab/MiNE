interface MiNEWordmarkProps {
  className?: string;
}

export function MiNEWordmark({ className = '' }: MiNEWordmarkProps) {
  return (
    <span className={`font-black tracking-tighter ${className}`} aria-label="MiNE">
      M<span className="text-[#78B800]" aria-hidden="true">i</span>NE
    </span>
  );
}
