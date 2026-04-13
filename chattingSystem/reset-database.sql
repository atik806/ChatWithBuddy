-- COMPLETE DATABASE RESET SCRIPT
-- Run this in Supabase SQL Editor to completely reset your database

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

-- Step 2: Drop all tables
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Step 3: Create users table with correct column names
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  email TEXT NOT NULL,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL DEFAULT '{}',
  "lastMessage" TEXT,
  "lastMessageTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "senderId" UUID NOT NULL,
  "senderName" TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policies for users
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (true);

-- Step 8: Create policies for conversations
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = ANY(participants));
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = ANY(participants));

-- Step 9: Create policies for messages
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = messages."conversationId" 
    AND auth.uid() = ANY(participants)
  )
);
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (auth.uid() = "senderId");

-- Step 10: Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Step 11: Drop and recreate storage policies
DROP POLICY IF EXISTS "Users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

CREATE POLICY "Users can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Step 12: Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 13: Create function to delete old messages with media (older than 15 days)
CREATE OR REPLACE FUNCTION delete_old_media()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete messages with images or files older than 15 days
  DELETE FROM messages 
  WHERE (image_url IS NOT NULL OR file_url IS NOT NULL)
  AND created_at < NOW() - INTERVAL '15 days';
END;
$$;

-- Step 14: Schedule the cleanup job to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'delete-old-media',
  '0 3 * * *',
  'SELECT delete_old_media()'
);

-- Done! Your database is now completely reset with the correct schema.
-- Messages with images and files older than 15 days will now be automatically deleted daily at 3 AM UTC.
