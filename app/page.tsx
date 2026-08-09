'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Image as ImageIcon, Bot, User, Loader2 } from 'lucide-react';

export default function Home() {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Ses çalma fonksiyonu (Admin cevap verdiğinde uyarı vermesi için)
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(700, audioContext.currentTime); // Farklı bir nota
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {}
  };

  // Oturum yönetimi
  useEffect(() => {
    let storedConvId = localStorage.getItem('user_conv_id');
    if (!storedConvId) {
      supabase.from('conversations').insert([{ title: 'Kullanıcı Sohbeti' }]).select().single()
        .then(({ data }) => {
          if (data) {
            localStorage.setItem('user_conv_id', data.id);
            setConvId(data.id);
          }
        });
    } else {
      setConvId(storedConvId);
    }
  }, []);

  // Mesajları Realtime dinle
  useEffect(() => {
    if (!convId) return;

    // Başlangıçta yükle
    const loadMessages = async () => {
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    loadMessages();

    // Yeni mesajları anlık dinle
    const channel = supabase
      .channel('user-realtime-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          if (payload.new.sender === 'ai') {
            playNotificationSound(); // Admin mesaj atınca ses çal
          }
          setMessages((prev) => [...prev, payload.new]);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [convId]);

  const handleSend = async (imageUrl?: string) => {
    if ((!input.trim() && !imageUrl) || !convId) return;
    const userText = input;
    setInput('');

    await supabase.from('messages').insert([
      { conversation_id: convId, sender: 'user', content: userText, image_url: imageUrl },
    ]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !convId) return;
    setIsUploading(true);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const { data: uploadData } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (uploadData) {
      const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      await handleSend(data.publicUrl);
    }
    setIsUploading(false);
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#212121] text-gray-100 font-sans fixed inset-0">
      <div className="flex-1 flex flex-col h-full max-w-3xl mx-auto w-full relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-4 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 mt-1 shadow-md">
                  <Bot size={18} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${m.sender === 'user' ? 'bg-[#303030] text-white' : 'bg-transparent text-gray-100'}`}>
                {m.image_url && <img src={m.image_url} alt="Görsel" className="max-w-xs max-h-60 rounded-lg mb-2 object-cover border border-white/10" />}
                {m.content && <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-[#212121] shrink-0 border-t border-white/5">
          <div className="relative bg-[#303030] rounded-2xl p-2 flex items-center border border-white/10 shadow-lg">
            <label className="p-3 text-gray-400 hover:text-white cursor-pointer transition">
              {isUploading ? <Loader2 size={20} className="animate-spin text-emerald-500" /> : <ImageIcon size={20} />}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Yapay zekaya mesaj yazın..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none px-2 pt-3"
              rows={1}
            />
            <button onClick={() => handleSend()} className="p-3 bg-white text-black rounded-xl hover:opacity-80 transition">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}