import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User } from "lucide-react";
import { ChatMessage } from "../types";

interface ChatAreaProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (msg: string) => void;
}

export default function ChatArea({ messages, loading, onSendMessage }: ChatAreaProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full relative">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400">
               <Bot className="w-12 h-12 mb-4 opacity-50" />
               <p className="text-lg">How can Echo assist you today?</p>
             </div>
          )}

          {messages.map((chat, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* User Bubble */}
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[80%]">
                  <p className="leading-relaxed">{chat.user}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              {/* AI Bubble */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm max-w-[80%]">
                  <p className="leading-relaxed whitespace-pre-wrap">{chat.ai}</p>
                </div>
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              <div className="bg-white border border-gray-200 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5">
                <motion.div className="w-2 h-2 bg-purple-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.div className="w-2 h-2 bg-purple-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                <motion.div className="w-2 h-2 bg-purple-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-gray-100 p-4 pb-6">
        <div className="max-w-3xl mx-auto relative flex items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message Echo..."
            disabled={loading}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-full py-3.5 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow shadow-sm disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}