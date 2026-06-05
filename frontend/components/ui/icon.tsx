import { cn } from '@/lib/utils';

export interface IconProps {
  name: string;
  className?: string;
  size?: number;
  spin?: boolean;
  filled?: boolean;
}

export function Icon({ name, className, size = 24, spin = false, filled = false }: IconProps) {
  return (
    <span
      className={cn(
        'material-symbols-outlined inline-flex shrink-0 items-center justify-center leading-none select-none',
        spin && 'animate-spin',
        className,
      )}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}

export function IconSpinner({ className, size = 20 }: Pick<IconProps, 'className' | 'size'>) {
  return <Icon name="progress_activity" className={className} size={size} spin />;
}
