import { Droplet } from 'lucide-react';
import { cn } from '@/lib/utils';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface BloodGroupSelectorProps {
  onSelect: (bloodGroup: string) => void;
  onClose: () => void;
}

export function BloodGroupSelector({ onSelect, onClose }: BloodGroupSelectorProps) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-slide-up">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Droplet className="w-8 h-8 text-red-500" />
          <h2 className="text-xl font-bold text-center">Select Blood Group</h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {BLOOD_GROUPS.map((group) => (
            <button
              key={group}
              onClick={() => onSelect(group)}
              className={cn(
                'flex items-center justify-center p-4 rounded-xl',
                'bg-red-600 text-white font-bold text-lg',
                'transition-all duration-200 active:scale-95',
                'shadow-lg hover:bg-red-700'
              )}
            >
              {group}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-4 mt-4 rounded-xl bg-secondary text-secondary-foreground font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
