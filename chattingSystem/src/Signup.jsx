import { useState } from "react";
import { supabase } from "./supabase";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import "./Signup.css";

function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            displayName
          }
        }
      });
      
      if (error) throw error;

      if (data.user) {
        await supabase.from("users").insert({
          id: data.user.id,
          displayName,
          email,
          createdAt: new Date().toISOString()
        });
      }
      
      setSuccess("Account created successfully! Please check your email to verify.");
      setTimeout(() => {
        navigate("/chat");
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/chat"
        }
      });
      
      if (error) throw error;
    } catch (err) {
      setError(getErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (message) => {
    if (message.includes("already registered")) return "This email is already registered. Try signing in instead.";
    if (message.includes("Invalid email")) return "Please enter a valid email address.";
    if (message.includes("Password")) return "Password is too weak. Use at least 6 characters.";
    if (message.includes("network") || message.includes("fetch")) return "Network error. Please check your internet connection.";
    return "Signup failed. Please try again.";
  };

  return (
    <div className="signup-container">
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
      <div className="signup-box">
        <h1>Create Account</h1>
        <p className="subtitle">Join the chat community</p>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSignup}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <button onClick={handleGoogleSignup} className="google-btn" disabled={loading}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "Please wait..." : "Continue with Google"}
        </button>

        <p className="login-link">
          Already have an account? <Link to="/">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;