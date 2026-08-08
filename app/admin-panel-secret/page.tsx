'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Bot, MessageSquare, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AdminPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sohbet listesini getir (Her 2 saniyede bir)
  useEffect(() => {
    const fetchConversations = async () => {
      const { data } = await supabase.from('conversations').select('*').order('created_at', { ascending: false });
      if (data) setConversations(data);
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 2000);
    return () => clearInterval(interval);
  }, []);

  // Seçilen sohbetin mesajlarını getir
  useEffect(() => {
    if (!selectedConvId) return;

    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', selectedConvId).order('created_at', { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1500);
    return () => clearInterval(interval);
  }, [selectedConvId]);

  const handleAdminSend = async () => {
    if (!reply.trim() || !selectedConvId) return;

    const replyText = reply;
    setReply('');

    setMessages((prev) => [...prev, { id: Date.now(), sender: 'ai', content: replyText }]);

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    await supabase.from('messages').insert([
      { conversation_id: selectedConvId, sender: 'ai', content: replyText }
    ]);
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#121212] text-gray-100 font-sans fixed inset-0">
      
      {/* Sol Sidebar - Sohbet Listesi (Mobilde bir sohbet seçildiyse gizlenir, masaüstünde hep görünür) */}
      <div className={`w-full md:w-80 bg-[#1e1e1e] border-r border-white/10 flex flex-col shrink-0 h-full ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-red-950/30 text-red-400 font-bold shrink-0">
          <ShieldAlert size={20} /> Gizli Yönetim Paneli
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <p className="text-xs text-gray-500 font-bold px-3 py-2">Gelen Sohbetler</p>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedConvId(c.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${
                selectedConvId === c.id ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300' : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              <MessageSquare size={18} />
              <div className="truncate">
                <p className="text-sm font-medium">Kullanıcı #{c.id.slice(0, 5)}</p>
                <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleTimeString()}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sağ Kısım - Mesajlaşma Alanı (Mobilde sohbet seçilmediyse gizlenir, seçildiyse tam ekran olur) */}
      <div className={`flex-1 flex flex-col h-full relative overflow-hidden bg-[#121212] ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        {selectedConvId ? (
          <>
            {/* Üst Bar (Mobilde listeye geri dönme butonu eklendi) */}
            <div className="bg-[#1e1e1e] p-4 border-b border-white/10 text-sm font-semibold text-emerald-400 flex items-center gap-3 shrink-0">
              <button 
                onClick={() => setSelectedConvId(null)} 
                className="md:hidden p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                title="Geri Dön"
              >
                <ArrowLeft size={18} />
              </button>
              <Bot size={18} /> Yapay Zeka Adına Cevap Veriyorsunuz
            </div>

            {/* Mesaj Listesi */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                  {m.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0 text-xs font-bold">
                      USER
                    </div>
                  )}
                  <div className={`max-w-[80%] md:max-w-[70%] p-3.5 rounded-2xl text-sm ${m.sender === 'user' ? 'bg-[#2a2a2a] text-white border border-white/10' : 'bg-emerald-700 text-white'}`}>
                    {m.image_url && <img src={m.image_url} alt="Görsel" className="max-w-xs max-h-56 rounded-lg mb-2 object-cover" />}
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                  </div>
                  {m.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">
                      AI
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Alanı */}
            <div className="bg-[#1e1e1e] p-3 md:p-4 border-t border-white/10 shrink-0">
              <div className="max-w-4xl mx-auto flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminSend()}
                  placeholder="Cevabı Yaz"
                  className="flex-1 bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 transition"
                />
                <button onClick={handleAdminSend} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 md:px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 shrink-0">
                  <Send size={16} /> <span className="hidden sm:inline">AI Olarak</span> Gönder
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 p-6 text-center">
            Yanıtlamak için sol taraftan bir sohbet seçin.
          </div>
        )}
      </div>

    </div>
  );
}