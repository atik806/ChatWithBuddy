import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { Link } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import "./Chat.css";

function Chat() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageFilter, setMessageFilter] = useState("all");
  const [filteredMessages, setFilteredMessages] = useState([]);
  const messageRefs = useRef({});
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [message, setMessage] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();

  // Fetch user profile
  const fetchUserData = useCallback(async (uid) => {
    const { data } = await supabase.from("users").select("*").eq("id", uid).single();
    if (data) setUserData(data);
  }, []);

  // Fetch conversations - single optimized query
  const fetchConversations = useCallback(async (uid) => {
    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .contains("participants", [uid])
      .order("lastMessageTime", { ascending: false });

    if (!convos?.length) { setConversations([]); return; }

    // Get all unique other user IDs in one query
    const otherIds = [...new Set(convos.map(c => c.participants.find(p => p !== uid)).filter(Boolean))];
    const { data: users } = await supabase
      .from("users")
      .select("id, displayName, email, avatarUrl")
      .in("id", otherIds);

    const usersMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    setConversations(convos.map(c => ({
      ...c,
      otherUser: usersMap[c.participants.find(p => p !== uid)] || null
    })));
  }, []);

  // Initial data load
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await Promise.all([fetchUserData(user.id), fetchConversations(user.id)]);
      setLoading(false);
    };
    init();

    // Re-fetch conversations when tab becomes active again
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchConversations(user.id);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, fetchUserData, fetchConversations]);

  // Real-time messages subscription
  useEffect(() => {
    if (!selectedChat?.id || !user?.id) return;

    fetchMessages(selectedChat.id);

    // Clear only current user's unread count
    const clearUnread = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("unreadCount")
        .eq("id", selectedChat.id)
        .single();

      const current = data?.unreadCount || {};
      if (current[user.id] > 0) {
        const updated = { ...current, [user.id]: 0 };
        await supabase.from("conversations").update({ unreadCount: updated }).eq("id", selectedChat.id);
      }
      // Always clear in UI
      setConversations(prev => prev.map(c =>
        c.id === selectedChat.id
          ? { ...c, unreadCount: { ...(c.unreadCount || {}), [user.id]: 0 } }
          : c
      ));
    };

    clearUnread();

    const channel = supabase
      .channel(`messages-${selectedChat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${selectedChat.id}`
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new].sort((a, b) => a.timestamp - b.timestamp);
        });
        // Auto-clear when receiving a message in the open chat
        if (payload.new.sender_id !== user.id) {
          clearUnread();
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedChat?.id, user?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async (convoId) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("timestamp", { ascending: true });
    setMessages(data || []);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); setShowSearch(false); return; }

    setSearchLoading(true);
    setShowSearch(true);

    const { data } = await supabase
      .from("users")
      .select("id, displayName, email, avatarUrl")
      .ilike("displayName", `%${query}%`)
      .neq("id", user?.id)
      .limit(10);

    setSearchResults(data || []);
    setSearchLoading(false);
  };

  const handleMessageSearch = (query) => {
    setMessageSearchQuery(query);
    if (!query.trim() && messageFilter === "all") {
      setFilteredMessages([]);
      return;
    }

    let results = [...messages];
    
    if (messageFilter === "images") {
      results = results.filter(m => m.image_url);
    } else if (messageFilter === "files") {
      results = results.filter(m => m.file_url);
    } else if (messageFilter === "sent") {
      results = results.filter(m => m.sender_id === user.id);
    } else if (messageFilter === "received") {
      results = results.filter(m => m.sender_id !== user.id);
    }

    if (query.trim()) {
      results = results.filter(m => 
        m.text?.toLowerCase().includes(query.toLowerCase()) ||
        m.sender_name?.toLowerCase().includes(query.toLowerCase())
      );
    }

    setFilteredMessages(results);
  };

  const handleFilterChange = (filter) => {
    setMessageFilter(filter);
    handleMessageSearch(messageSearchQuery);
  };

  const jumpToMessage = (msgId) => {
    const msgElement = messageRefs.current[msgId];
    if (msgElement) {
      msgElement.scrollIntoView({ behavior: "smooth", block: "center" });
      msgElement.classList.add("highlight-message");
      setTimeout(() => msgElement.classList.remove("highlight-message"), 2000);
    }
    setShowMessageSearch(false);
    setMessageSearchQuery("");
    setFilteredMessages([]);
  };

  const getMessagePreview = (msg) => {
    if (msg.image_url) return "📷 Image";
    if (msg.file_url) return `📎 ${msg.file_name}`;
    return msg.text?.length > 50 ? msg.text.substring(0, 50) + "..." : msg.text;
  };

  const startConversation = async (otherUser) => {
    const existing = conversations.find(c => c.participants?.includes(otherUser.id));
    if (existing) {
      setSelectedChat(existing);
    } else {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ participants: [user.id, otherUser.id], lastMessage: "", lastMessageTime: new Date().toISOString() })
        .select().single();
      if (error) { console.error(error); return; }
      const newConvo = { ...data, otherUser };
      setConversations(prev => [newConvo, ...prev]);
      setSelectedChat(newConvo);
    }
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedChat?.id) return;

    const text = message.trim();
    const senderName = userData?.displayName || user.email?.split("@")[0] || "User";
    const tempId = `temp-${Date.now()}`;
    const temp = { id: tempId, conversation_id: selectedChat.id, sender_id: user.id, sender_name: senderName, text, image_url: null, timestamp: Date.now() };

    setMessages(prev => [...prev, temp]);
    setMessage("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedChat.id,
        sender_id: user.id,
        sender_name: senderName,
        text,
        image_url: null,
        timestamp: Date.now()
      })
      .select()
      .single();

    if (error) {
      console.error("Send message error:", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setMessage(text); // restore message on error
      return;
    }

    // Replace temp with real message from DB
    setMessages(prev => prev.map(m => m.id === tempId ? data : m));

    const otherUserId = selectedChat.participants?.find(p => p !== user.id);
    const convo = conversations.find(c => c.id === selectedChat.id);
    const currentUnread = convo?.unreadCount?.[otherUserId] || 0;
    const unread = { ...(convo?.unreadCount || {}), [otherUserId]: currentUnread + 1 };

    await supabase.from("conversations").update({
      lastMessage: text,
      lastMessageTime: new Date().toISOString(),
      unreadCount: unread
    }).eq("id", selectedChat.id);

    setConversations(prev =>
      prev.map(c => c.id === selectedChat.id
        ? { ...c, lastMessage: text, lastMessageTime: new Date().toISOString(), unreadCount: unread }
        : c
      ).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))
    );
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat?.id) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) { alert("Please select a valid image"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Image must be less than 10MB"); return; }

    setImageUploading(true);
    const senderName = userData?.displayName || user.email?.split("@")[0] || "User";

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${selectedChat.id}/${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("chat-images").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("chat-images").getPublicUrl(filePath);
      const temp = { id: `temp-${Date.now()}`, conversation_id: selectedChat.id, sender_id: user.id, sender_name: senderName, text: null, image_url: publicUrl, timestamp: Date.now() };
      setMessages(prev => [...prev, temp]);

      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: selectedChat.id, sender_id: user.id, sender_name: senderName, text: null, image_url: publicUrl, timestamp: Date.now() })
        .select().single();

      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === temp.id ? data : m));

      const otherUserId = selectedChat.participants?.find(p => p !== user.id);
      const convo = conversations.find(c => c.id === selectedChat.id);
      const unread = { ...(convo?.unreadCount || {}), [otherUserId]: ((convo?.unreadCount?.[otherUserId] || 0) + 1) };

      await supabase.from("conversations").update({ lastMessage: "📷 Image", lastMessageTime: new Date().toISOString(), unreadCount: unread }).eq("id", selectedChat.id);
      setConversations(prev => prev.map(c => c.id === selectedChat.id ? { ...c, lastMessage: "📷 Image", lastMessageTime: new Date().toISOString(), unreadCount: unread } : c));
    } catch (err) {
      console.error("Image send error:", err);
      alert(`Failed to send image: ${err.message}`);
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat?.id) return;

    if (file.size > 25 * 1024 * 1024) { alert("File must be less than 25MB"); return; }

    setFileUploading(true);
    const senderName = userData?.displayName || user.email?.split("@")[0] || "User";

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${selectedChat.id}/${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("chat-files").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("chat-files").getPublicUrl(filePath);

      const temp = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedChat.id,
        sender_id: user.id,
        sender_name: senderName,
        text: null,
        image_url: null,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, temp]);

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedChat.id,
          sender_id: user.id,
          sender_name: senderName,
          text: null,
          image_url: null,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          timestamp: Date.now()
        })
        .select().single();

      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === temp.id ? data : m));

      const otherUserId = selectedChat.participants?.find(p => p !== user.id);
      const convo = conversations.find(c => c.id === selectedChat.id);
      const unread = { ...(convo?.unreadCount || {}), [otherUserId]: ((convo?.unreadCount?.[otherUserId] || 0) + 1) };

      await supabase.from("conversations").update({
        lastMessage: `📎 ${file.name}`,
        lastMessageTime: new Date().toISOString(),
        unreadCount: unread
      }).eq("id", selectedChat.id);

      setConversations(prev => prev.map(c => c.id === selectedChat.id
        ? { ...c, lastMessage: `📎 ${file.name}`, lastMessageTime: new Date().toISOString(), unreadCount: unread }
        : c
      ));
    } catch (err) {
      console.error("File send error:", err);
      alert(`Failed to send file: ${err.message}`);
    } finally {
      setFileUploading(false);
      e.target.value = "";
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleLogout = async () => {    await supabase.auth.signOut();
    // AuthContext will detect session change and ProtectedRoute will redirect
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-primary)", color: "var(--text-muted)", flexDirection: "column", gap: "16px" }}>
      <svg viewBox="0 0 24 24" width="40" height="40" fill="var(--gradient-start)" className="spin">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
      </svg>
      <span style={{ fontSize: "14px" }}>Loading...</span>
    </div>
  );

  return (
    <div className="chat-dashboard">
      <aside className="sidebar">
        <div className="user-profile">
          <div className="avatar">
            {userData?.avatarUrl ? (
              <img src={userData.avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            ) : getInitials(userData?.displayName || user?.email)}
          </div>
          <div className="user-info">
            <h3>{userData?.displayName || user?.email?.split("@")[0] || "User"}</h3>
            <p>{user?.email}</p>
          </div>
          <div className="user-actions">
            <Link to="/profile" className="profile-btn" title="Profile">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </Link>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
              {isDarkMode ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" /></svg>
              )}
            </button>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search users by name..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {showSearch && (
          <div className="search-results">
            {searchLoading ? (
              <div className="search-loading">Searching...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map(result => (
                <div key={result.id} className="search-result-item" onClick={() => startConversation(result)}>
                  <div className="avatar small">
                    {result.avatarUrl ? (
                      <img src={result.avatarUrl} alt={result.displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : getInitials(result.displayName)}
                  </div>
                  <div className="result-info">
                    <span className="name">{result.displayName}</span>
                    <span className="email">{result.email}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="search-no-results">No users found</div>
            )}
          </div>
        )}

        <div className="conversations-header"><h2>Conversations</h2></div>

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="no-conversations">
              <p>No conversations yet</p>
              <p className="hint">Search for users to start chatting</p>
            </div>
          ) : (
            conversations.map(convo => {
              const unreadCount = convo.unreadCount?.[user.id] || 0;
              return (
                <div
                  key={convo.id}
                  className={`conversation-item ${selectedChat?.id === convo.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedChat(convo);
                    setConversations(prev => prev.map(c =>
                      c.id === convo.id
                        ? { ...c, unreadCount: { ...(c.unreadCount || {}), [user.id]: 0 } }
                        : c
                    ));
                  }}
                >
                  <div className="avatar">
                    {convo.otherUser?.avatarUrl ? (
                      <img src={convo.otherUser.avatarUrl} alt={convo.otherUser.displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : getInitials(convo.otherUser?.displayName)}
                  </div>
                  <div className="convo-info">
                    <div className="convo-header">
                      <span className="name">{convo.otherUser?.displayName || "Unknown"}</span>
                      <span className="time">{convo.lastMessageTime ? new Date(convo.lastMessageTime).toLocaleDateString() : ""}</span>
                    </div>
                    <div className="convo-footer">
                      <p className={`last-message ${unreadCount > 0 ? "unread" : ""}`}>{convo.lastMessage || "No messages yet"}</p>
                      {unreadCount > 0 && <span className="unread-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className="chat-area">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <button className="back-to-conversations" onClick={() => setSelectedChat(null)} title="Back to conversations">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </button>
              <div className="chat-header-info" onClick={() => setShowChatInfo(!showChatInfo)}>
                <div className="avatar">
                  {selectedChat.otherUser?.avatarUrl ? (
                    <img src={selectedChat.otherUser.avatarUrl} alt={selectedChat.otherUser.displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : getInitials(selectedChat.otherUser?.displayName)}
                </div>
                <div className="chat-user-info">
                  <h3>{selectedChat.otherUser?.displayName || "Unknown User"}</h3>
                  <p>{selectedChat.otherUser?.email}</p>
                </div>
              </div>
              <button className={`info-btn ${showChatInfo ? "active" : ""}`} onClick={() => setShowChatInfo(!showChatInfo)} title="Chat Info">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </button>
            </div>

            {showChatInfo && (
              <div className="chat-info-panel">
                <div className="chat-info-header">
                  <button className="back-btn" onClick={() => setShowChatInfo(false)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                    Back
                  </button>
                  <h3>Chat Info</h3>
                </div>
                
                <div className="chat-info-user">
                  <div className="info-avatar">
                    {selectedChat.otherUser?.avatarUrl ? (
                      <img src={selectedChat.otherUser.avatarUrl} alt={selectedChat.otherUser.displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : getInitials(selectedChat.otherUser?.displayName)}
                  </div>
                  <h4>{selectedChat.otherUser?.displayName || "Unknown User"}</h4>
                  <p>{selectedChat.otherUser?.email}</p>
                </div>

                <div className="chat-info-section">
                  <h4>Search Messages</h4>
                  <div className="search-input-wrapper">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="search-icon">
                      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search in conversation..."
                      value={messageSearchQuery}
                      onChange={(e) => handleMessageSearch(e.target.value)}
                    />
                    {messageSearchQuery && (
                      <button className="clear-search" onClick={() => { setMessageSearchQuery(""); setFilteredMessages([]); }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="filter-tabs">
                    <button className={`filter-tab ${messageFilter === "all" ? "active" : ""}`} onClick={() => handleFilterChange("all")}>All</button>
                    <button className={`filter-tab ${messageFilter === "images" ? "active" : ""}`} onClick={() => handleFilterChange("images")}>📷</button>
                    <button className={`filter-tab ${messageFilter === "files" ? "active" : ""}`} onClick={() => handleFilterChange("files")}>📎</button>
                    <button className={`filter-tab ${messageFilter === "sent" ? "active" : ""}`} onClick={() => handleFilterChange("sent")}>Sent</button>
                    <button className={`filter-tab ${messageFilter === "received" ? "active" : ""}`} onClick={() => handleFilterChange("received")}>Received</button>
                  </div>

                  <div className="search-results-list">
                    {filteredMessages.length === 0 ? (
                      <div className="no-search-results">
                        {messageSearchQuery || messageFilter !== "all" ? "No messages found" : "Type to search messages"}
                      </div>
                    ) : (
                      filteredMessages.map(msg => (
                        <div key={msg.id} className={`search-message-item ${msg.sender_id === user.id ? "sent" : "received"}`} onClick={() => jumpToMessage(msg.id)}>
                          <div className="search-msg-avatar">
                            <span className={`sender-badge ${msg.sender_id === user.id ? "sent" : "received"}`}>
                              {msg.sender_id === user.id ? "You" : msg.sender_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="search-msg-content">
                            <div className="search-msg-preview">{getMessagePreview(msg)}</div>
                            <div className="search-msg-time">
                              {new Date(msg.timestamp).toLocaleDateString()} at {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                          <div className="jump-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="search-stats">
                    {messages.length} messages • {filteredMessages.length} shown
                  </div>
                </div>

                <div className="chat-info-section">
                  <h4>Conversation Stats</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-value">{messages.length}</span>
                      <span className="stat-label">Total Messages</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{messages.filter(m => m.sender_id === user.id).length}</span>
                      <span className="stat-label">Sent</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{messages.filter(m => m.image_url).length}</span>
                      <span className="stat-label">Images</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{messages.filter(m => m.file_url).length}</span>
                      <span className="stat-label">Files</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages"><p>No messages yet. Say hello!</p></div>
              ) : (
                <>
                  {messages.map(msg => (
                    <div key={msg.id} ref={el => messageRefs.current[msg.id] = el} className={`message ${msg.sender_id === user.id ? "sent" : "received"}`}>
                      <div className="message-content">
                        {msg.image_url ? (
                          <div className="message-image">
                            <img src={msg.image_url} alt="Shared image" onClick={() => window.open(msg.image_url, "_blank")} />
                          </div>
                        ) : msg.file_url ? (
                          <a className="message-file" href={msg.file_url} target="_blank" rel="noopener noreferrer" download={msg.file_name}>
                            <div className="file-icon">
                              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                              </svg>
                            </div>
                            <div className="file-info">
                              <span className="file-name">{msg.file_name}</span>
                              <span className="file-size">{formatFileSize(msg.file_size)}</span>
                            </div>
                            <div className="file-download">
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                            </div>
                          </a>
                        ) : <p>{msg.text}</p>}
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="message-input-container">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: "none" }} />
              <input type="file" ref={docInputRef} onChange={handleFileSelect} style={{ display: "none" }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.mp4,.mp3,.csv" />
              <button className="image-btn" onClick={() => fileInputRef.current?.click()} disabled={imageUploading || fileUploading} title="Send image">
                {imageUploading ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="spin"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                )}
              </button>
              <button className="image-btn" onClick={() => docInputRef.current?.click()} disabled={imageUploading || fileUploading} title="Send file">
                {fileUploading ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="spin"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" /></svg>
                )}
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button className="send-btn" onClick={sendMessage} disabled={imageUploading || fileUploading}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" /></svg>
              <h2>Welcome to Chat</h2>
              <p>Select a conversation or search for users to start chatting</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Chat;
