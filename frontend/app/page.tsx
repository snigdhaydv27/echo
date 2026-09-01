"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import { ChatSession } from "../types";
import { v4 as uuidv4 } from "uuid";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export default function Home() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Load saved chats from local storage on initial mount
  useEffect(() => {
    const saved = localStorage.getItem("echo_chats");
    if (saved) {
      const parsed = JSON.parse(saved);
      setChats(parsed);
      if (parsed.length > 0) setCurrentChatId(parsed[0].id);
    } else {
      handleNewChat(); // Create initial chat if empty
    }
  }, []);

  // Save to local storage whenever chats update
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("echo_chats", JSON.stringify(chats));
    }
  }, [chats]);

  const handleNewChat = async () => {
    const newId = uuidv4();
    const newChat: ChatSession = { id: newId, title: "New Chat", messages: [], updatedAt: Date.now() };
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newId);
    
    // Wipe backend short-term memory buffer
    try {
      await fetch(`${API_URL}/api/clear`, { method: "POST" });
    } catch (e) {
      console.error("Failed to clear backend memory", e);
    }
  };

  const currentChat = chats.find((c) => c.id === currentChatId) || chats[0];

  const handleSendMessage = async (userMessage: string) => {
    if (!currentChat) return;
    setLoading(true);

    // Optimistic UI update
    let updatedTitle = currentChat.title;
    if (currentChat.messages.length === 0) {
      updatedTitle = userMessage.length > 30 ? userMessage.substring(0, 30) + "..." : userMessage;
    }

    const updatedChats = chats.map(c => 
      c.id === currentChatId 
        ? { ...c, title: updatedTitle, messages: [...c.messages, { user: userMessage, ai: "" }] } 
        : c
    );
    setChats(updatedChats);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      
      // Update with actual AI response
      setChats((prev) => prev.map(c => 
        c.id === currentChatId 
          ? { 
              ...c, 
              updatedAt: Date.now(),
              messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, ai: data.reply } : m) 
            } 
          : c
      ).sort((a, b) => b.updatedAt - a.updatedAt));

    } catch (err) {
      alert("Error: Backend offline.");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden md:block">
        <Sidebar 
          chats={chats} 
          currentChatId={currentChatId} 
          onSelectChat={setCurrentChatId} 
          onNewChat={handleNewChat} 
        />
      </div>
      <ChatArea 
        messages={currentChat?.messages || []} 
        loading={loading} 
        onSendMessage={handleSendMessage} 
      />
    </div>
  );
}