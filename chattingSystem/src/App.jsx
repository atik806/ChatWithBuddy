import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./Login";
import Signup from "./Signup";
import Chat from "./Chat";
import Profile from "./Profile";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App;