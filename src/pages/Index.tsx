import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { EmergencyButton } from '@/components/EmergencyButton';
import { ContactsList } from '@/components/ContactsList';
import { AlertsFeed } from '@/components/AlertsFeed';
import { ProfileHeader } from '@/components/ProfileHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Bell, Users } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    profile,
    contacts,
    alerts,
    sending,
    sendEmergencyAlert,
    addContact,
    deleteContact,
  } = useEmergencyAlerts();

  // Initialize push notifications
  usePushNotifications();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <ProfileHeader
        name={profile.name}
        uniqueId={profile.unique_id}
        locationStatus="active"
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 pb-4">
        {/* Emergency Button Section */}
        <div className="flex-1 flex items-center justify-center py-8">
          <EmergencyButton
            onTrigger={sendEmergencyAlert}
            disabled={sending}
          />
        </div>

        {/* Bottom Tabs */}
        <Tabs defaultValue="contacts" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="quick" className="gap-2">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Quick Dial</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-0">
            <ContactsList
              contacts={contacts}
              onAdd={addContact}
              onDelete={deleteContact}
            />
          </TabsContent>

          <TabsContent value="alerts" className="mt-0">
            <AlertsFeed alerts={alerts} />
          </TabsContent>

          <TabsContent value="quick" className="mt-0">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Quick Emergency Dial</h3>
              <a
                href="tel:911"
                className="flex items-center gap-4 p-4 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                  <Phone className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-bold text-lg">911</p>
                  <p className="text-sm text-muted-foreground">Emergency Services</p>
                </div>
              </a>
              <a
                href="tel:112"
                className="flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg">112</p>
                  <p className="text-sm text-muted-foreground">International Emergency</p>
                </div>
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
