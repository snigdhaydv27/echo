import { Plus, MessageSquare, Sparkles } from "lucide-react";
import { ChatSession } from "../types";

interface SidebarProps {
  chats: ChatSession[];
  currentChatId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({ chats, currentChatId, onSelectChat, onNewChat }: SidebarProps) {
  return (
    <div className="w-64 bg-gray-900 text-gray-100 flex flex-col h-full border-r border-gray-800">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h1 className="text-lg font-semibold tracking-wide">Echo</h1>
        </div>
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <p className="px-3 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Recent</p>
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left truncate transition-colors ${
              currentChatId === chat.id ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{chat.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}