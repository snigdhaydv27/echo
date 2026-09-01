'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatArea() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Backend is offline or waking up." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearMemory = async () => {
    try {
      await fetch(`${API_URL}/api/clear`, { method: "POST" });
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear history");
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Echo AI Assistant</h1>
        <button onClick={clearMemory} className="px-3 py-1 text-sm bg-red-500 text-white rounded">
          Clear Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded bg-gray-50 dark:bg-zinc-900">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-zinc-800'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-400 text-sm">Echo is thinking...</div>}
      </div>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded dark:bg-zinc-800"
        />
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
          Send
        </button>
      </form>
    </div>
  );
}