import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import "./Chat.css";

function Chat() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
      } else {
        setUser(session.user);
        await fetchUserData(session.user.id);
        await fetchConversations(session.user.id);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/");
      } else {
        setUser(session.user);
        fetchUserData(session.user.id);
        fetchConversations(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (selectedChat?.id) {
      fetchMessages(selectedChat.id);
      
      const channel = supabase
        .channel(`messages-${selectedChat.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversationId=eq.${selectedChat.id}`
        }, (payload) => {
          console.log("Real-time message received:", payload);
          setMessages(prev => {
            // Check if message already exists
            if (prev.find(m => m.id === payload.new.id)) {
              return prev;
            }
            return [...prev, payload.new].sort((a, b) => a.timestamp - b.timestamp);
          });
        })
        .subscribe((status) => {
          console.log("Subscription status:", status);
        });

      return () => {
        console.log("Unsubscribing from channel");
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChat?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUserData = async (uid) => {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();
      
      if (data) setUserData(data);
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  const fetchConversations = async (uid) => {
    try {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .contains("participants", [uid])
        .order("lastMessageTime", { ascending: false });

      if (data) {
        const convosWithUsers = await Promise.all(
          data.map(async (convo) => {
            const otherUserId = convo.participants.find(p => p !== uid);
            if (otherUserId) {
              const { data: otherUser } = await supabase
                .from("users")
                .select("id, displayName, email")
                .eq("id", otherUserId)
                .single();
              return { ...convo, otherUser };
            }
            return convo;
          })
        );
        setConversations(convosWithUsers);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  const fetchMessages = async (convoId) => {
    try {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversationId", convoId)
        .order("timestamp", { ascending: true });
      
      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    
    setSearchLoading(true);
    setShowSearch(true);
    
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, displayName, email")
        .ilike("displayName", `%${query}%`)
        .neq("id", user?.id);

      if (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } else {
        console.log("Search results:", data);
        setSearchResults(data || []);
      }
    } catch (err) {
      console.error("Error searching users:", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const startConversation = async (otherUser) => {
    try {
      const existingConvo = conversations.find(
        c => c.participants && c.participants.includes(otherUser.id)
      );
      
      if (existingConvo) {
        setSelectedChat(existingConvo);
      } else {
        const { data, error } = await supabase
          .from("conversations")
          .insert({
            participants: [user.id, otherUser.id],
            lastMessage: "",
            lastMessageTime: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        setSelectedChat({
          id: data.id,
          participants: [user.id, otherUser.id],
          otherUser
        });
        
        await fetchConversations(user.id);
      }
      
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      console.error("Error starting conversation:", err);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedChat?.id) return;
    
    const messageText = message.trim();
    const tempMessage = {
      id: `temp-${Date.now()}`,
      conversationId: selectedChat.id,
      senderId: user.id,
      senderName: userData?.displayName || user.email?.split('@')[0] || "User",
      text: messageText,
      timestamp: Date.now(),
      createdAt: new Date().toISOString()
    };

    // Immediately add message to UI
    setMessages(prev => [...prev, tempMessage]);
    setMessage("");
    
    try {
      console.log("Sending message:", {
        conversationId: selectedChat.id,
        senderId: user.id,
        senderName: userData?.displayName || user.email?.split('@')[0] || "User",
        text: messageText,
        timestamp: Date.now()
      });

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversationId: selectedChat.id,
          senderId: user.id,
          senderName: userData?.displayName || user.email?.split('@')[0] || "User",
          text: messageText,
          timestamp: Date.now()
        })
        .select()
        .single();

      if (error) {
        console.error("Insert message error:", error);
        // Remove temp message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        alert(`Failed to send message: ${error.message}`);
        return;
      }

      console.log("Message inserted:", data);

      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempMessage.id ? data : m));

      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          lastMessage: messageText,
          lastMessageTime: new Date().toISOString()
        })
        .eq("id", selectedChat.id);

      if (updateError) {
        console.error("Update conversation error:", updateError);
      }

      await fetchConversations(user.id);
    } catch (err) {
      console.error("Error sending message:", err);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      alert(`Failed to send message: ${err.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  return (
    <div className="chat-dashboard">
      <aside className="sidebar">
        <div className="user-profile">
          <div className="avatar">
            {getInitials(userData?.displayName || user.email)}
          </div>
          <div className="user-info">
            <h3>{userData?.displayName || user.email?.split('@')[0] || "User"}</h3>
            <p>{user.email}</p>
          </div>
          <div className="user-actions">
            <Link to="/profile" className="profile-btn" title="Profile">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </Link>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
              {isDarkMode ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              )}
            </button>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
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
                    {getInitials(result.displayName)}
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

        <div className="conversations-header">
          <h2>Conversations</h2>
        </div>

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="no-conversations">
              <p>No conversations yet</p>
              <p className="hint">Search for users to start chatting</p>
            </div>
          ) : (
            conversations.map(convo => (
              <div
                key={convo.id}
                className={`conversation-item ${selectedChat?.id === convo.id ? 'active' : ''}`}
                onClick={() => setSelectedChat(convo)}
              >
                <div className="avatar">
                  {getInitials(convo.otherUser?.displayName)}
                </div>
                <div className="convo-info">
                  <div className="convo-header">
                    <span className="name">{convo.otherUser?.displayName || "Unknown User"}</span>
                    <span className="time">
                      {convo.lastMessageTime ? new Date(convo.lastMessageTime).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="last-message">{convo.lastMessage || "No messages yet"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="chat-area">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <div className="avatar">
                {getInitials(selectedChat.otherUser?.displayName)}
              </div>
              <div className="chat-user-info">
                <h3>{selectedChat.otherUser?.displayName || "Unknown User"}</h3>
                <p>{selectedChat.otherUser?.email}</p>
              </div>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message ${msg.senderId === user.id ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">
                        <p>{msg.text}</p>
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="message-input-container">
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="send-btn" onClick={sendMessage}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
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