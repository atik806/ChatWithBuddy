# Real-Time Chat Application

A modern, real-time chat application built with React and Supabase, featuring user authentication, instant messaging, and a beautiful responsive UI with dark mode support.

## ✨ Features

- **User Authentication**
  - Email/Password signup and login
  - Google OAuth integration
  - Secure session management

- **Real-Time Messaging**
  - Instant message delivery
  - Real-time updates using Supabase subscriptions
  - Message timestamps
  - Auto-scroll to latest messages

- **User Management**
  - User search by display name
  - Profile management
  - Avatar upload support
  - Display name customization

- **Modern UI/UX**
  - Dark/Light theme toggle
  - Fully responsive design (mobile, tablet, desktop)
  - Gradient backgrounds
  - Smooth animations and transitions
  - Clean, intuitive interface

## 🚀 Tech Stack

- **Frontend**: React 19.2.4
- **Routing**: React Router DOM 7.14.0
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Build Tool**: Vite 8.0.4
- **Styling**: CSS3 with CSS Variables
- **Authentication**: Supabase Auth

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chattingSystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the `chattingSystem` directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase Database**
   
   - Go to your Supabase Dashboard
   - Navigate to SQL Editor
   - Copy the contents of `src/schema.sql`
   - Paste and run the SQL script

5. **Enable Real-time (Optional)**
   
   For real-time messaging:
   - Go to Database → Replication in Supabase
   - Enable replication for the `messages` table

6. **Configure Google OAuth (Optional)**
   
   If you want Google login:
   - Set up OAuth credentials in Google Cloud Console
   - Add credentials to Supabase Authentication → Providers → Google
   - Add authorized redirect URIs

## 🏃 Running the Application

**Development mode:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## 📱 Usage

1. **Sign Up / Login**
   - Create an account with email/password
   - Or use Google OAuth

2. **Search for Users**
   - Use the search bar to find users by display name
   - Click on a user to start a conversation

3. **Send Messages**
   - Type your message in the input field
   - Press Enter or click the send button
   - Messages appear instantly for both users

4. **Manage Profile**
   - Click the profile icon in the sidebar
   - Update your display name
   - Upload a profile picture
   - Toggle dark/light theme

## 🗂️ Project Structure

```
chattingSystem/
├── src/
│   ├── assets/          # Static assets
│   ├── App.jsx          # Main app component with routing
│   ├── Chat.jsx         # Chat interface
│   ├── Chat.css         # Chat styles
│   ├── Login.jsx        # Login page
│   ├── Login.css        # Login styles
│   ├── Signup.jsx       # Signup page
│   ├── Signup.css       # Signup styles
│   ├── Profile.jsx      # User profile page
│   ├── Profile.css      # Profile styles
│   ├── ThemeContext.jsx # Theme management
│   ├── supabase.js      # Supabase client configuration
│   ├── schema.sql       # Database schema
│   ├── index.css        # Global styles and CSS variables
│   └── main.jsx         # App entry point
├── .env.local           # Environment variables (create this)
├── .gitignore           # Git ignore rules
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── README.md            # This file
```

## 🎨 Customization

### Theme Colors

Edit CSS variables in `src/index.css`:

```css
:root {
  --gradient-start: #667eea;
  --gradient-end: #764ba2;
  --bg-primary: #ffffff;
  --text-primary: #333333;
  /* ... more variables */
}
```

### Dark Mode

Dark mode is automatically applied based on user preference and persisted in localStorage.

## 🔒 Security Features

- Row Level Security (RLS) enabled on all tables
- Users can only access their own conversations
- Secure authentication with Supabase Auth
- Environment variables for sensitive data
- Input validation and sanitization

## 📊 Database Schema

### Tables

**users**
- `id` (UUID) - Primary key, linked to auth.users
- `displayName` (TEXT) - User's display name
- `email` (TEXT) - User's email
- `avatarUrl` (TEXT) - Profile picture URL
- `createdAt` (TIMESTAMP) - Account creation date
- `updatedAt` (TIMESTAMP) - Last update

**conversations**
- `id` (UUID) - Primary key
- `participants` (UUID[]) - Array of user IDs
- `lastMessage` (TEXT) - Last message preview
- `lastMessageTime` (TIMESTAMP) - Last message timestamp
- `createdAt` (TIMESTAMP) - Conversation creation date

**messages**
- `id` (UUID) - Primary key
- `conversationId` (UUID) - Foreign key to conversations
- `senderId` (UUID) - Message sender
- `senderName` (TEXT) - Sender's display name
- `text` (TEXT) - Message content
- `timestamp` (BIGINT) - Message timestamp in milliseconds
- `createdAt` (TIMESTAMP) - Database creation time

## 🐛 Troubleshooting

**Messages not appearing in real-time:**
- Enable replication for the `messages` table in Supabase
- Check browser console for subscription errors

**Can't find users in search:**
- Verify users exist in the `users` table
- Check RLS policies are correctly set up

**Google OAuth not working:**
- Verify OAuth credentials in Supabase
- Check redirect URIs are correctly configured
- Ensure Google provider is enabled

**Database errors:**
- Run the schema.sql script again
- Check column names match (camelCase)
- Verify RLS policies are active

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 👨‍💻 Author

Built with ❤️ using React and Supabase

## 🙏 Acknowledgments

- Supabase for the amazing backend platform
- React team for the excellent framework
- Vite for the blazing fast build tool
