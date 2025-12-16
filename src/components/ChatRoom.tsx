import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  is_public: boolean;
  sender_name: string;
  created_at: string;
}

interface ChatRoomProps {
  onClose: () => void;
}

export function ChatRoom({ onClose }: ChatRoomProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'public' | 'direct'>('public');
  const [directChatUser, setDirectChatUser] = useState<{ id: string; name: string } | null>(null);
  const [users, setUsers] = useState<{ user_id: string; name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();

    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.is_public || newMsg.sender_id === user?.id || newMsg.receiver_id === user?.id) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(data);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name');

    if (!error && data) {
      setUsers(data.filter(u => u.user_id !== user?.id));
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        receiver_id: directChatUser?.id || null,
        message: newMessage.trim(),
        is_public: activeTab === 'public' && !directChatUser,
        sender_name: profile?.name || 'Unknown'
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'public' && !directChatUser) {
      return msg.is_public;
    }
    if (directChatUser) {
      return (
        (msg.sender_id === user?.id && msg.receiver_id === directChatUser.id) ||
        (msg.sender_id === directChatUser.id && msg.receiver_id === user?.id)
      );
    }
    return false;
  });

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-bold">
            {directChatUser ? `Chat with ${directChatUser.name}` : 'Community Chat'}
          </h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => { setActiveTab('public'); setDirectChatUser(null); }}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'public' && !directChatUser ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          Public Chat
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'direct' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          Direct Messages
        </button>
      </div>

      {activeTab === 'direct' && !directChatUser && (
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {users.map((u) => (
              <button
                key={u.user_id}
                onClick={() => setDirectChatUser({ id: u.user_id, name: u.name })}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80"
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">{u.name}</span>
              </button>
            ))}
            {users.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No other users available</p>
            )}
          </div>
        </ScrollArea>
      )}

      {(activeTab === 'public' || directChatUser) && (
        <>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    }`}
                  >
                    {msg.sender_id !== user?.id && (
                      <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>
                    )}
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
