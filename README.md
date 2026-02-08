# onemore!

A React Native (Expo) app for tracking drinks among friends in a bar. Built with TypeScript, Supabase, and iOS-native design patterns.

## Features

- Create sessions and invite friends via deep links
- Real-time synchronized drink tracking
- Configurable drink types with prices
- Calculate total amount owed per person
- Clean iOS-native UI with haptics

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- Supabase account and project
- iOS Simulator (for iOS testing) or Expo Go app

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the migration script from `supabase-migration.sql`
3. Go to Project Settings > API
4. Copy your Project URL and anon/public key

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Alternatively, you can set these in `app.json` under `expo.extra`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "your_supabase_project_url",
      "supabaseAnonKey": "your_supabase_anon_key"
    }
  }
}
```

### 4. Enable Anonymous Authentication in Supabase

1. Go to Authentication > Providers in Supabase dashboard
2. Enable "Anonymous" provider
3. Save changes

### 5. Enable Realtime in Supabase

1. Go to Database > Replication in Supabase dashboard
2. Enable replication for all tables: `sessions`, `participants`, `drink_types`, `drink_events`

### 6. Run the App

```bash
npm start
# Then press 'i' for iOS simulator or scan QR code with Expo Go
```

## Project Structure

```
drink-counter/
├── app/                    # Expo Router routes
│   ├── _layout.tsx         # Root layout with navigation
│   ├── index.tsx          # Home: sessions list
│   ├── create-session.tsx  # Create new session
│   ├── join/[code].tsx     # Join session by code
│   ├── session/[id].tsx      # Live scoreboard
│   ├── session/[id]/settings.tsx # Owner settings
│   └── privacy.tsx          # Privacy policy
├── src/
│   ├── lib/
│   │   └── supabase.ts    # Supabase client
│   ├── repo/
│   │   ├── sessions.ts      # Session repository functions
│   │   └── participants.ts  # Participant repository functions
│   ├── types/
│   │   └── database.ts      # TypeScript types for DB rows
│   └── utils/
│       ├── currency.ts      # Currency formatting
│       └── invite.ts       # Invite code generation
├── supabase-migration.sql  # Database schema + RLS policies
└── package.json
```

## Testing Checklist

### Create Session Flow
- [ ] Open app, tap "+" to create session
- [ ] Enter session name
- [ ] Add at least 2 participants
- [ ] Submit and verify navigation to session screen
- [ ] Verify default drink types are created (Cerveza, Refresco, Copa)
- [ ] Verify invite code is generated

### Join Flow (Deep Link)
- [ ] Copy invite link from session screen
- [ ] Open link in another device/simulator
- [ ] Verify join screen shows unclaimed participants
- [ ] Tap a participant name to claim
- [ ] Verify navigation to session screen after claim
- [ ] Try claiming same participant from another device (should fail gracefully)

### Live Session
- [ ] Add drinks by tapping drink buttons on participant cards
- [ ] Verify drink count and total amount update
- [ ] Long press participant card to open action sheet
- [ ] Test "Add drink..." option
- [ ] Test "Subtract last drink" option
- [ ] Verify haptic feedback on drink add
- [ ] Open session on multiple devices
- [ ] Add drink on one device, verify it appears on others (realtime)

### Settings (Owner Only)
- [ ] Open settings from session screen (gear icon)
- [ ] Edit drink type name, emoji, price
- [ ] Reorder drink types (up/down)
- [ ] Delete drink type
- [ ] Add new drink type
- [ ] Add new participant slot
- [ ] Remove participant slot
- [ ] Verify non-owner cannot edit (controls disabled)

### Error Handling
- [ ] Test with invalid invite code (should show error)
- [ ] Test network offline (should show last state)
- [ ] Test claiming already-claimed participant (should show error)

## Deep Linking

The app supports deep links in the format:
- `onemore://join/<invite_code>`
- Universal links: `https://yourdomain.com/join/<invite_code>`

To test deep links:
```bash
# iOS Simulator
xcrun simctl openurl booted "onemore://join/ABC12345"

# Or use Expo Linking API in development
```

## Troubleshooting

### "Missing Supabase environment variables" error
- Ensure `.env` file exists with correct variables
- Or set variables in `app.json` under `expo.extra`
- Restart Expo dev server after adding env vars

### Realtime not working
- Verify Realtime is enabled in Supabase dashboard
- Check that tables are added to Realtime publication
- Verify RLS policies allow SELECT for authenticated users

### Anonymous auth failing
- Ensure Anonymous provider is enabled in Supabase
- Check Supabase project URL and anon key are correct

### Deep links not working
- Verify scheme is set in `app.json` (`"scheme": "onemore"`)
- For iOS, may need to configure Associated Domains for universal links
- Test with `expo-linking` API first

## License

MIT
