import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import "./Profile.css";

function Profile() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
      }
    };
    getSession();
  }, [navigate]);

  const fetchUserData = async (uid) => {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();
      
      if (data) {
        setUserData(data);
        setDisplayName(data.displayName || "");
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const updates = {
        displayName,
        updatedAt: new Date().toISOString()
      };

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      await supabase
        .from("users")
        .update({ avatarUrl: publicUrl })
        .eq("id", user.id);

      setUserData({ ...userData, avatarUrl: publicUrl });
      setMessage("Avatar updated successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    <div className="profile-container">
      <div className="profile-header">
        <button className="back-btn" onClick={() => navigate("/chat")}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <h1>Profile</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
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
      </div>

      <div className="profile-content">
        <div className="avatar-section">
          <div className="avatar-large">
            {userData?.avatarUrl ? (
              <img src={userData.avatarUrl} alt="Avatar" />
            ) : (
              getInitials(userData?.displayName || user.email)
            )}
          </div>
          <label className="avatar-upload">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={loading}
            />
            <span>Change Photo</span>
          </label>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleUpdateProfile} className="profile-form">
          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="disabled"
            />
          </div>

          <div className="form-group">
            <label>Member Since</label>
            <input
              type="text"
              value={userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "Unknown"}
              disabled
              className="disabled"
            />
          </div>

          <button type="submit" className="save-btn" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <button onClick={handleLogout} className="logout-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Profile;