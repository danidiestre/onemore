# Quick Start Guide

## Step-by-Step Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

1. **Create Supabase Project**
   - Go to https://supabase.com and create a new project
   - Wait for the project to finish provisioning

2. **Run Migration**
   - In Supabase dashboard, go to SQL Editor
   - Copy and paste the entire contents of `supabase-migration.sql`
   - Click "Run" to execute the migration

3. **Enable Anonymous Auth**
   - Go to Authentication > Providers
   - Find "Anonymous" and toggle it ON
   - Save changes

4. **Enable Realtime**
   - Go to Database > Replication
   - Enable replication for these tables:
     - `sessions`
     - `participants`
     - `drink_types`
     - `drink_events`

5. **Get API Credentials**
   - Go to Project Settings > API
   - Copy the "Project URL" (e.g., `https://xxxxx.supabase.co`)
   - Copy the "anon public" key

### 3. Configure Environment

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Add App Assets (Optional)

Add these files to the `assets/` folder:
- `icon.png` (1024x1024px) - App icon
- `splash.png` (1242x2436px) - Splash screen

You can skip this for now - Expo will use defaults.

### 5. Run the App

```bash
npm start
```

Then:
- Press `i` to open iOS Simulator
- Or scan QR code with Expo Go app on your phone

## First Test

1. Tap the "+" button to create a session
2. Enter a session name (e.g., "Friday Night")
3. Add at least 2 participants (e.g., "Alice", "Bob")
4. Tap "Create Session"
5. You should see the session screen with drink buttons
6. Tap the "Share" button to get an invite link
7. Open the link on another device to test the join flow

## Troubleshooting

**"Missing Supabase environment variables"**
- Make sure `.env` file exists and has correct values
- Restart Expo dev server after creating `.env`

**Realtime not updating**
- Verify Realtime is enabled in Supabase Dashboard > Database > Replication
- Check that all 4 tables have replication enabled

**Can't create session**
- Verify Anonymous auth is enabled in Supabase
- Check browser console for detailed error messages

**Deep links not working**
- In development, deep links work via Expo Go
- For production, configure Associated Domains in app.json
