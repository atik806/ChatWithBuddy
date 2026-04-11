  -- Run this in your Supabase SQL Editor

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    displayName TEXT,
    email TEXT,
    avatarUrl TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Conversations table
  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participants UUID[] DEFAULT '{}',
    lastMessage TEXT,
    lastMessageTime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Messages table
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversationId UUID REFERENCES conversations(id) ON DELETE CASCADE,
    senderId UUID,
    senderName TEXT,
    text TEXT,
    timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Enable Row Level Security
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

  -- Drop existing user policies if they exist
  DROP POLICY IF EXISTS "Users can view all profiles" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON users;

  -- Policies for users - Allow everyone to read all users
  CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
  CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
  CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (true);

  -- Policies for conversations
  DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;

  CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = ANY(participants));
  CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = ANY(participants));
  CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = ANY(participants));

  -- Policies for messages
  DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
  DROP POLICY IF EXISTS "Users can insert messages" ON messages;

  CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversationId 
      AND auth.uid() = ANY(participants)
    )
  );
  CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (auth.uid() = senderId);

  -- Storage bucket for avatars
  INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

  -- Create new policies
  CREATE POLICY "Users can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);
  CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);