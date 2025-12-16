import { cn } from '@/lib/utils';

interface VSLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export function VSLogo({ size = 'md', className, showText = false }: VSLogoProps) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 text-2xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center font-bold text-primary-foreground shadow-lg',
          sizes[size]
        )}
      >
        VS
      </div>
      {showText && (
        <span className="font-bold text-foreground">Emergency Alert</span>
      )}
    </div>
  );
}
