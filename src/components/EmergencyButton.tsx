import { useState, useRef, useEffect } from 'react';
import { Phone, Droplet, MessageCircle, AlertTriangle, Car, Heart, Flame, HelpCircle, Camera, Upload } from 'lucide-react';
import { BloodGroupSelector } from './BloodGroupSelector';
import { BloodRequestModal } from './BloodRequestModal';
import { ChatRoom } from './ChatRoom';
import { useBloodRequests } from '@/hooks/useBloodRequests';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmergencyButtonProps {
  onTrigger: (type: string, targetRoles?: string[], imageUrl?: string) => Promise<{ success: boolean; nearbyCount: number }>;
  disabled?: boolean;
}

const EMERGENCY_TYPES = [
  { id: 'help', label: 'HELP', icon: HelpCircle, color: 'bg-blue-500', targetRoles: ['user'] },
  { id: 'accident', label: 'ACCIDENT', icon: Car, color: 'bg-yellow-500', targetRoles: ['medical'] },
  { id: 'medical', label: 'MEDICAL', icon: Heart, color: 'bg-red-500', targetRoles: ['medical'] },
  { id: 'fire', label: 'FIRE', icon: Flame, color: 'bg-orange-500', targetRoles: ['fire_rescue'] },
];

export function EmergencyButton({ onTrigger, disabled }: EmergencyButtonProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showBloodSelector, setShowBloodSelector] = useState(false);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentMapsLink, setCurrentMapsLink] = useState('');
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type: string; targetRoles: string[]; label: string }>({
    open: false, type: '', targetRoles: [], label: ''
  });

  // Medical image upload state
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendBloodRequest, sending: bloodSending } = useBloodRequests();
  const { getCurrentLocation, generateMapsLink } = useGeolocation();
  
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    
    holdTimerRef.current = setTimeout(async () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setHoldProgress(0);
      // Show confirmation for SOS too
      setConfirmDialog({ open: true, type: 'sos', targetRoles: [], label: 'SOS (All Nearby Users)' });
    }, 1500);
  };

  const handleRelease = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setHoldProgress(0);
  };

  const handleTypeSelect = (type: string, targetRoles: string[]) => {
    if (type === 'medical') {
      // Show image upload option for medical emergencies
      setShowImageUpload(true);
      setPrescriptionImage(null);
      return;
    }
    const label = EMERGENCY_TYPES.find(t => t.id === type)?.label || type.toUpperCase();
    setConfirmDialog({ open: true, type, targetRoles, label });
  };

  const handleConfirmAlert = async () => {
    const { type, targetRoles } = confirmDialog;
    setConfirmDialog({ open: false, type: '', targetRoles: [], label: '' });
    setIsTriggering(true);
    try {
      await onTrigger(type, targetRoles);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleMedicalConfirm = async () => {
    setShowImageUpload(false);
    setIsTriggering(true);
    try {
      await onTrigger('medical', ['medical'], prescriptionImage || undefined);
    } finally {
      setIsTriggering(false);
      setPrescriptionImage(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `prescriptions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('prescriptions')
        .getPublicUrl(filePath);

      setPrescriptionImage(publicUrl);
      toast.success('Prescription image uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
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

  const circumference = 2 * Math.PI * 105;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Main SOS Button */}
      <div className="relative">
        <svg
          className="absolute inset-0 -rotate-90 transform"
          width="220"
          height="220"
          viewBox="0 0 220 220"
        >
          <circle cx="110" cy="110" r="105" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="110" cy="110" r="105" fill="none"
            stroke="hsl(var(--primary))" strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" className="transition-all duration-100"
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

      {/* Emergency Type Buttons */}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: '', targetRoles: [], label: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirm Emergency Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send a <strong>{confirmDialog.label}</strong> alert? This will notify nearby emergency responders and users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAlert} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Send Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Medical Emergency Image Upload Dialog */}
      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Medical Emergency
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optionally upload a prescription or medical document to help responders.
            </p>
            
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {prescriptionImage ? (
              <div className="relative">
                <img src={prescriptionImage} alt="Prescription" className="w-full rounded-lg border max-h-48 object-cover" />
                <button
                  onClick={() => setPrescriptionImage(null)}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
              >
                {uploadingImage ? (
                  <div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tap to upload prescription</span>
                  </>
                )}
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowImageUpload(false); setPrescriptionImage(null); }}
                className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleMedicalConfirm}
                disabled={isTriggering}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Send Medical Alert
              </button>
            </div>
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
        <ChatRoom onClose={() => setShowChat(false)} />
      )}

      {/* Action Buttons Row */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={handleBloodButtonClick}
          disabled={bloodSending || gettingLocation}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-red-600 text-white font-semibold transition-all hover:bg-red-700 active:scale-95 shadow-lg disabled:opacity-50"
        >
          <Droplet className="w-6 h-6" />
          <span>{gettingLocation ? 'Getting Location...' : bloodSending ? 'Sending...' : 'Request Blood'}</span>
        </button>
        
        <div className="flex gap-3">
          <a
            href="tel:911"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium transition-all hover:bg-secondary/80 active:scale-95"
          >
            <Phone className="w-5 h-5" />
            <span>Call 911</span>
          </a>
          
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
