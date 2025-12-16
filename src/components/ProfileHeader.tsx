import { User, LogOut, MapPin, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VSLogo } from './VSLogo';

interface ProfileHeaderProps {
  name: string;
  uniqueId: string;
  locationStatus?: 'active' | 'updating' | 'error';
}

export function ProfileHeader({ name, uniqueId, locationStatus = 'active' }: ProfileHeaderProps) {
  const { signOut } = useAuth();

  const statusColors = {
    active: 'bg-success',
    updating: 'bg-warning animate-pulse',
    error: 'bg-destructive',
  };

  return (
    <header className="flex items-center justify-between p-4 safe-bottom">
      <div className="flex items-center gap-3">
        <VSLogo size="sm" />
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColors[locationStatus]}`}
          />
        </div>
        <div>
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">ID: {uniqueId}</p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="gap-2">
            <MapPin className="w-4 h-4" />
            <span>Location: {locationStatus}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
