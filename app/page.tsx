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

  // Ziyaretçiye özel oturum (sohbet ID) oluştur veya olanı al
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedConvId = localStorage.getItem('user_conv_id');
    if (!storedConvId) {
      supabase
        .from('conversations')
        .insert([{ title: 'Kullanıcı Sohbeti' }])
        .select()
        .single()
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

  // Mesajları getir ve her 1.5 saniyede bir kontrol et (Aşağı kaydırma tetiklemez!)
  useEffect(() => {
    if (!convId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };

    loadMessages();
    const interval = setInterval(loadMessages, 1500);
    return () => clearInterval(interval);
  }, [convId]);

  // Sadece ilk açılışta en alta kaydır
  useEffect(() => {
    if (messages.length > 0 && !convId) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [convId]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isWaitingForResponse = lastMessage && lastMessage.sender === 'user';

  const handleSend = async (imageUrl?: string) => {
    if ((!input.trim() && !imageUrl) || !convId || isWaitingForResponse) return;

    const userText = input;
    setInput('');

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'user', content: userText, image_url: imageUrl },
    ]);

    // Kullanıcı mesaj attığında otomatik olarak aşağı kaydır
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    await supabase.from('messages').insert([
      { conversation_id: convId, sender: 'user', content: userText, image_url: imageUrl },
    ]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isWaitingForResponse || isUploading) return;
    const file = e.target.files?.[0];
    if (!file || !convId) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('chat-images').upload(fileName, file);
      
      if (uploadError) {
        alert('Fotoğraf yüklenirken hata oluştu: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      
      if (publicUrlData?.publicUrl) {
        await handleSend(publicUrlData.publicUrl);
      }
    } catch (err) {
      console.error('Yükleme hatası:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#212121] text-gray-100 font-sans fixed inset-0">
      <div className="flex-1 flex flex-col h-full max-w-3xl mx-auto w-full relative">
        
        {/* Mesaj Listesi (Artık yukarı kaydırıp inceleyebilirsin, otomatik aşağı atmaz) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 mt-20">
              <Bot size={48} className="text-emerald-500" />
              <p className="text-xl font-medium">Size nasıl yardımcı olabilirim?</p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-4 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 mt-1 shadow-md">
                  <Bot size={18} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                  m.sender === 'user' ? 'bg-[#303030] text-white' : 'bg-transparent text-gray-100'
                }`}
              >
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt="Görsel"
                    className="max-w-xs max-h-60 rounded-lg mb-2 object-cover border border-white/10"
                  />
                )}
                {m.content && <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>}
              </div>
              {m.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-1 shadow-md">
                  <User size={18} className="text-white" />
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Mesaj Input Kutusu (Sabit ve taşma yapmayan yapı) */}
        <div className="p-4 bg-[#212121] shrink-0 border-t border-white/5">
          <div className="relative bg-[#303030] rounded-2xl p-2 flex items-center border border-white/10 focus-within:border-white/30 transition shadow-lg">
            <label className={`p-3 text-gray-400 ${isWaitingForResponse || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-white cursor-pointer'} transition`}>
              {isUploading ? <Loader2 size={20} className="animate-spin text-emerald-500" /> : <ImageIcon size={20} />}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                disabled={isWaitingForResponse || isUploading} 
                className="hidden" 
              />
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isWaitingForResponse) handleSend();
                }
              }}
              placeholder={isWaitingForResponse ? "Yönetici yanıtı bekleniyor..." : isUploading ? "Fotoğraf yükleniyor..." : "Yapay zekaya mesaj yazın..."}
              disabled={isWaitingForResponse || isUploading}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none px-2 max-h-32 min-h-[44px] pt-3 disabled:opacity-50"
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              className={`p-3 rounded-xl transition m-1 flex items-center justify-center ${
                isWaitingForResponse || isUploading
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                  : 'bg-white text-black hover:opacity-80'
              }`}
              disabled={(!input.trim() && !isUploading) || isWaitingForResponse || isUploading}
            >
              {isWaitingForResponse ? (
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="4" ry="4" />
                </svg>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}