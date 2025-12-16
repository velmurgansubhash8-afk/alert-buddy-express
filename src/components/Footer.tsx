import { VSLogo } from './VSLogo';

export function Footer() {
  return (
    <footer className="py-4 px-6 border-t border-border/50 bg-card/30">
      <div className="flex flex-col items-center gap-2 text-center">
        <VSLogo size="sm" />
        <p className="text-xs text-muted-foreground">
          Created by <span className="font-semibold text-foreground">Subhash</span>, <span className="font-semibold text-foreground">Vijayan</span> & <span className="font-semibold text-foreground">Vishnuvarathan</span>
        </p>
        <p className="text-xs text-muted-foreground/60">VS Emergency Alert System</p>
      </div>
    </footer>
  );
}
