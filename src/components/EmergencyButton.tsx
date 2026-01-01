import { useState, useRef, useEffect } from 'react';
import { Phone, Droplet, MessageCircle, AlertTriangle, Car, Heart, Flame, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { BloodGroupSelector } from './BloodGroupSelector';
import { BloodRequestModal } from './BloodRequestModal';
import { ChatRoom } from './ChatRoom';
import { useBloodRequests } from '@/hooks/useBloodRequests';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cn } from '@/lib/utils';

interface EmergencyButtonProps {
  onTrigger: (type: string, targetRoles?: string[]) => Promise<{ success: boolean; nearbyCount: number }>;
  disabled?: boolean;
}

const EMERGENCY_TYPES = [
  { id: 'help', label: 'HELP', icon: HelpCircle, color: 'bg-blue-500', targetRoles: [] as string[] },
  { id: 'accident', label: 'ACCIDENT', icon: Car, color: 'bg-yellow-500', targetRoles: ['medical', 'user'] },
  { id: 'medical', label: 'MEDICAL', icon: Heart, color: 'bg-red-500', targetRoles: ['medical'] },
  { id: 'fire', label: 'FIRE', icon: Flame, color: 'bg-orange-500', targetRoles: ['fire_rescue', 'user'] },
];

export function EmergencyButton({ onTrigger, disabled }: EmergencyButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showBloodSelector, setShowBloodSelector] = useState(false);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentMapsLink, setCurrentMapsLink] = useState('');
  
  const { sendBloodRequest, sending: bloodSending } = useBloodRequests();
  const { getCurrentLocation, generateMapsLink } = useGeolocation();
  
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handlePress = () => {
    if (disabled || isTriggering) return;
    
    setHoldProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setHoldProgress(prev => Math.min(prev + 2, 100));
    }, 30);
    
    holdTimerRef.current = setTimeout(() => {
      setIsExpanded(true);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setHoldProgress(0);
    }, 1500);
  };

  const handleRelease = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setHoldProgress(0);
  };

  const handleTypeSelect = async (type: string, targetRoles: string[]) => {
    setIsTriggering(true);
    setIsExpanded(false);
    
    try {
      await onTrigger(type, targetRoles);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleBloodButtonClick = async () => {
    setGettingLocation(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        setCurrentMapsLink(generateMapsLink(location.latitude, location.longitude));
      } else {
        setCurrentMapsLink('');
      }
      setShowBloodSelector(true);
    } catch (error) {
      console.error('Error getting location:', error);
      setCurrentMapsLink('');
      setShowBloodSelector(true);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleBloodGroupSelect = (group: string) => {
    setSelectedBloodGroup(group);
    setShowBloodSelector(false);
  };

  const handleBloodRequestSubmit = async (message: string) => {
    if (!selectedBloodGroup) return;
    
    const result = await sendBloodRequest(selectedBloodGroup, message);
    if (result.success) {
      setSelectedBloodGroup(null);
    }
  };

  // Calculate the stroke dash for progress ring
  const circumference = 2 * Math.PI * 105;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Main SOS Button */}
      <div className="relative">
        {/* Progress Ring */}
        <svg
          className="absolute inset-0 -rotate-90 transform"
          width="220"
          height="220"
          viewBox="0 0 220 220"
        >
          <circle
            cx="110"
            cy="110"
            r="105"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
          />
          <circle
            cx="110"
            cy="110"
            r="105"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-100"
          />
        </svg>
        
        <button
          onMouseDown={handlePress}
          onMouseUp={handleRelease}
          onMouseLeave={handleRelease}
          onTouchStart={handlePress}
          onTouchEnd={handleRelease}
          disabled={disabled || isTriggering}
          className={cn(
            'emergency-button w-52 h-52 flex flex-col items-center justify-center gap-3',
            'text-primary-foreground font-bold text-xl',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isTriggering && 'animate-shake'
          )}
        >
          <AlertTriangle className="w-16 h-16" />
          <span className="text-lg">
            {isTriggering ? 'SENDING...' : 'HOLD FOR SOS'}
          </span>
        </button>
      </div>

      {/* Emergency Type Buttons - Always visible */}
      <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
        {EMERGENCY_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type.id, type.targetRoles)}
            disabled={disabled || isTriggering}
            className={cn(
              'flex flex-col items-center justify-center gap-1 p-3 rounded-xl',
              type.color,
              'text-white font-semibold text-xs',
              'transition-all duration-200',
              'hover:scale-105 active:scale-95',
              'shadow-lg disabled:opacity-50'
            )}
          >
            <type.icon className="w-6 h-6" />
            <span>{type.label}</span>
          </button>
        ))}
      </div>

      {/* Expanded Type Selection Modal (when long pressing SOS) */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-xs p-4">
          <DialogTitle className="text-center text-lg font-bold mb-4">
            🚨 Select Emergency Type
          </DialogTitle>
          <div className="grid grid-cols-2 gap-3">
            {EMERGENCY_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type.id, type.targetRoles)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-xl',
                  type.color,
                  'text-white font-semibold',
                  'transition-all duration-200',
                  'hover:scale-105 active:scale-95'
                )}
              >
                <type.icon className="w-8 h-8" />
                <span className="text-sm">{type.label}</span>
              </button>
            ))}
            <button
              onClick={() => handleTypeSelect('sos', [])}
              className="col-span-2 flex items-center justify-center gap-2 p-4 rounded-xl bg-destructive text-destructive-foreground font-bold transition-all hover:scale-105 active:scale-95"
            >
              <AlertTriangle className="w-8 h-8" />
              <span>SEND SOS TO ALL</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blood Group Selector */}
      {showBloodSelector && (
        <BloodGroupSelector
          onClose={() => setShowBloodSelector(false)}
          onSelect={handleBloodGroupSelect}
        />
      )}

      {/* Blood Request Modal */}
      {selectedBloodGroup && (
        <BloodRequestModal
          bloodGroup={selectedBloodGroup}
          onClose={() => setSelectedBloodGroup(null)}
          onSubmit={handleBloodRequestSubmit}
          sending={bloodSending}
          mapsLink={currentMapsLink}
        />
      )}

      {/* Chat Room */}
      {showChat && (
        <ChatRoom
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Action Buttons Row */}
      <div className="w-full max-w-sm space-y-3">
        {/* Blood Request Button */}
        <button
          onClick={handleBloodButtonClick}
          disabled={bloodSending || gettingLocation}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-red-600 text-white font-semibold transition-all hover:bg-red-700 active:scale-95 shadow-lg disabled:opacity-50"
        >
          <Droplet className="w-6 h-6" />
          <span>{gettingLocation ? 'Getting Location...' : bloodSending ? 'Sending...' : 'Request Blood'}</span>
        </button>
        
        <div className="flex gap-3">
          {/* Quick Dial 911 */}
          <a
            href="tel:911"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium transition-all hover:bg-secondary/80 active:scale-95"
          >
            <Phone className="w-5 h-5" />
            <span>Call 911</span>
          </a>
          
          {/* Chat Button */}
          <button
            onClick={() => setShowChat(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
