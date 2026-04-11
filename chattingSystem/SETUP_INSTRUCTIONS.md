# Chatting System - Setup Instructions

## Database Setup (IMPORTANT - Do This First!)

1. Go to your Supabase Dashboard
2. Open **SQL Editor**
3. Create a new query
4. Copy the entire content from `src/schema.sql`
5. Paste it into the SQL editor
6. Click **Run**

This will:
- Create the `users`, `conversations`, and `messages` tables
- Enable Row Level Security (RLS)
- Set up all security policies
- Create the avatars storage bucket

## Environment Variables

Your `.env.local` file is already configured with:
```
VITE_SUPABASE_URL=https://ogzuwpimvhrpayftcvir.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_kz8zq0Gsnd9RHBGfoCdUbg_WX_IcG0z
```

This file is protected by `.gitignore` and won't be committed to git.

## Running the App

```bash
npm run dev
```

The app will start at `http://localhost:5173`

## Features

- **Authentication**: Email/password signup and login
- **User Search**: Search for users by display name
- **Real-time Chat**: Send and receive messages instantly
- **User Profiles**: Update display name and avatar
- **Dark Mode**: Toggle between light and dark themes
- **Conversations**: View all your active conversations

## Testing

1. Sign up with an email address
2. Create another account with a different email
3. Search for the other user by their display name
4. Start a conversation and send messages
5. Messages will appear in real-time

## Troubleshooting

### "Could not find the 'createdAt' column"
- Run the schema.sql again in Supabase SQL Editor
- This refreshes the schema cache

### "Email rate limit exceeded"
- Wait a few hours before trying to sign up again
- Or disable email verification in Supabase Authentication settings

### Search not working
- Make sure users are created in the database
- Check browser console (F12) for error messages
- Verify RLS policies are enabled

### Messages not appearing
- Check that both users are in the same conversation
- Verify the `conversationId` matches in the database
- Check RLS policies for messages table

## Database Schema

### users table
- `id` (UUID) - Primary key, linked to auth.users
- `displayName` (TEXT) - User's display name
- `email` (TEXT) - User's email
- `avatarUrl` (TEXT) - URL to user's avatar
- `createdAt` (TIMESTAMP) - Account creation date
- `updatedAt` (TIMESTAMP) - Last profile update

### conversations table
- `id` (UUID) - Primary key
- `participants` (UUID[]) - Array of user IDs in conversation
- `lastMessage` (TEXT) - Last message sent
- `lastMessageTime` (TIMESTAMP) - When last message was sent
- `createdAt` (TIMESTAMP) - Conversation creation date

### messages table
- `id` (UUID) - Primary key
- `conversationId` (UUID) - Foreign key to conversations
- `senderId` (UUID) - User who sent the message
- `senderName` (TEXT) - Display name of sender
- `text` (TEXT) - Message content
- `timestamp` (BIGINT) - Message timestamp in milliseconds
- `createdAt` (TIMESTAMP) - When message was created

## Security

- All tables have Row Level Security (RLS) enabled
- Users can only see their own conversations
- Users can only send messages in conversations they're part of
- Avatar uploads are restricted to authenticated users
- Credentials are stored in `.env.local` and never committed to git
