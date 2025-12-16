import { useState } from 'react';
import { Droplet, MapPin, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface BloodRequestModalProps {
  bloodGroup: string;
  mapsLink: string;
  onSubmit: (message: string) => Promise<void>;
  onClose: () => void;
  sending: boolean;
}

export function BloodRequestModal({ bloodGroup, mapsLink, onSubmit, onClose, sending }: BloodRequestModalProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    await onSubmit(message);
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Blood Request</h2>
              <p className="text-muted-foreground">Blood Group: <span className="text-red-500 font-bold">{bloodGroup}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mapsLink ? (
          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
            <MapPin className="w-5 h-5 text-primary" />
            <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate">
              View Your Location
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/20 rounded-lg">
            <MapPin className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-yellow-500">Location will be fetched when sending</span>
          </div>
        )}

        <Textarea
          placeholder="Add a message (e.g., urgent need, hospital name, contact info)..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[100px]"
        />

        <Button
          onClick={handleSubmit}
          disabled={sending}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          {sending ? (
            'Sending Request...'
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Blood Request
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
