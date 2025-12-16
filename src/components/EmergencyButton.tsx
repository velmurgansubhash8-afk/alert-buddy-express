import { useState } from 'react';
import { AlertTriangle, Phone, Flame, Heart, Shield, Droplet, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BloodGroupSelector } from './BloodGroupSelector';
import { BloodRequestModal } from './BloodRequestModal';
import { ChatRoom } from './ChatRoom';
import { useBloodRequests } from '@/hooks/useBloodRequests';
import { useGeolocation } from '@/hooks/useGeolocation';

interface EmergencyButtonProps {
  onTrigger: (emergencyType: string) => Promise<{ success: boolean; nearbyCount: number }>;
  disabled?: boolean;
}

const EMERGENCY_TYPES = [
  { id: 'general', label: 'Emergency', icon: AlertTriangle, color: 'bg-primary' },
  { id: 'medical', label: 'Medical', icon: Heart, color: 'bg-pink-600' },
  { id: 'fire', label: 'Fire', icon: Flame, color: 'bg-orange-600' },
  { id: 'security', label: 'Security', icon: Shield, color: 'bg-blue-600' },
];

export function EmergencyButton({ onTrigger, disabled }: EmergencyButtonProps) {
  const [showTypes, setShowTypes] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const [showBloodSelector, setShowBloodSelector] = useState(false);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  
  const { sendBloodRequest, sending: bloodSending } = useBloodRequests();
  const { getCurrentLocation, generateMapsLink } = useGeolocation();
  const [currentMapsLink, setCurrentMapsLink] = useState('');

  const handlePress = () => {
    if (disabled || triggering) return;

    // Start hold timer
    const startTime = Date.now();
    const duration = 1000; // 1 second hold

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(timer);
        setShowTypes(true);
        setHoldProgress(0);
      }
    }, 50);

    setHoldTimer(timer);
  };

  const handleRelease = () => {
    if (holdTimer) {
      clearInterval(holdTimer);
      setHoldTimer(null);
    }
    setHoldProgress(0);
  };

  const handleTypeSelect = async (type: string) => {
    setTriggering(true);
    setShowTypes(false);
    try {
      await onTrigger(type);
    } finally {
      setTriggering(false);
    }
  };

  const handleBloodButtonClick = async () => {
    setShowTypes(false);
    const location = await getCurrentLocation();
    if (location) {
      setCurrentMapsLink(generateMapsLink(location.latitude, location.longitude));
    }
    setShowBloodSelector(true);
  };

  const handleBloodGroupSelect = (bloodGroup: string) => {
    setSelectedBloodGroup(bloodGroup);
    setShowBloodSelector(false);
  };

  const handleBloodRequestSubmit = async (message: string) => {
    if (!selectedBloodGroup) return;
    await sendBloodRequest(selectedBloodGroup, message);
    setSelectedBloodGroup(null);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Main Emergency Button */}
      <div className="relative">
        {/* Progress ring */}
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
            strokeDasharray={`${(holdProgress / 100) * 660} 660`}
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
          disabled={disabled || triggering}
          className={cn(
            'emergency-button w-52 h-52 flex flex-col items-center justify-center gap-3',
            'text-primary-foreground font-bold text-xl',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            triggering && 'animate-shake'
          )}
        >
          <AlertTriangle className="w-16 h-16" />
          <span className="text-lg">
            {triggering ? 'SENDING...' : 'HOLD FOR SOS'}
          </span>
        </button>
      </div>

      {/* Emergency Type Selector */}
      {showTypes && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-slide-up">
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-center mb-6">Select Emergency Type</h2>
            <div className="grid grid-cols-2 gap-4">
              {EMERGENCY_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-3 p-6 rounded-2xl',
                    'transition-all duration-200 active:scale-95',
                    type.color,
                    'text-white font-semibold shadow-lg'
                  )}
                >
                  <type.icon className="w-10 h-10" />
                  <span>{type.label}</span>
                </button>
              ))}
              {/* Blood Group Button - Next to Medical */}
              <button
                onClick={handleBloodButtonClick}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 p-6 rounded-2xl',
                  'transition-all duration-200 active:scale-95',
                  'bg-red-600 text-white font-semibold shadow-lg col-span-2'
                )}
              >
                <Droplet className="w-10 h-10" />
                <span>Blood Request</span>
              </button>
            </div>
            <button
              onClick={() => setShowTypes(false)}
              className="w-full py-4 mt-4 rounded-xl bg-secondary text-secondary-foreground font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Blood Group Selector */}
      {showBloodSelector && (
        <BloodGroupSelector
          onSelect={handleBloodGroupSelect}
          onClose={() => setShowBloodSelector(false)}
        />
      )}

      {/* Blood Request Modal */}
      {selectedBloodGroup && (
        <BloodRequestModal
          bloodGroup={selectedBloodGroup}
          mapsLink={currentMapsLink}
          onSubmit={handleBloodRequestSubmit}
          onClose={() => setSelectedBloodGroup(null)}
          sending={bloodSending}
        />
      )}

      {/* Chat Room */}
      {showChat && <ChatRoom onClose={() => setShowChat(false)} />}

      {/* Quick actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Blood Request Button */}
        <button
          onClick={handleBloodButtonClick}
          className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-red-600 text-white font-semibold transition-all hover:bg-red-700 active:scale-95 shadow-lg"
        >
          <Droplet className="w-6 h-6" />
          <span>Request Blood</span>
        </button>
        
        <div className="flex gap-3">
          <a
            href="tel:911"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-secondary text-secondary-foreground font-medium transition-all hover:bg-secondary/80"
          >
            <Phone className="w-5 h-5" />
            <span>Call 911</span>
          </a>
          <button
            onClick={() => setShowChat(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
