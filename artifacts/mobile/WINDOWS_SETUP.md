# MakersFlow - Windows Setup Guide

## Fixed Issues

1. ✅ Removed Replit-specific environment variables
2. ✅ Removed Replit-specific scripts (build.js, serve.js)
3. ✅ Fixed expo-router plugin configuration
4. ✅ Added proper web support with index.html
5. ✅ Fixed babel configuration
6. ✅ Enhanced metro.config for monorepo support
7. ✅ Removed unstable native tabs
8. ✅ Removed expo-glass-effect dependency
9. ✅ Removed expo-symbols iOS-specific icons
10. ✅ Fixed TypeScript configuration
11. ✅ Created expo-env.d.ts
12. ✅ Removed problematic workspace dependencies

## Installation & Running

### 1. Install Dependencies

```bash
cd artifacts/mobile
pnpm install
```

### 2. Start the Development Server

```bash
npx expo start
```

Or use package.json scripts:

```bash
pnpm start        # Start Expo dev server
pnpm web          # Start on web
pnpm android      # Start on Android emulator
pnpm ios          # Start on iOS simulator (macOS only)
```

### 3. Access the App

- **Web**: Press `w` in the terminal or visit http://localhost:8081
- **Android**: Press `a` to open Android emulator
- **Expo Go**: Scan QR code with Expo Go app on your phone

## Common Issues & Solutions

### Issue: Metro bundler fails to start
**Solution**: Clear cache and restart
```bash
npx expo start -c
```

### Issue: Module not found errors
**Solution**: Reinstall dependencies
```bash
rm -rf node_modules
pnpm install
```

### Issue: Web shows white screen
**Solution**: Check browser console for errors and ensure all imports are correct

### Issue: TypeScript errors
**Solution**: Run typecheck to see all errors
```bash
pnpm typecheck
```

## Project Structure

```
artifacts/mobile/
├── app/                    # Expo Router file-based routing
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (tabs)/            # Main app tabs (home, courses, store, news, profile)
│   ├── course/            # Course detail screens
│   ├── quiz/              # Quiz screens
│   ├── store/             # Store screens
│   ├── news/              # News screens
│   ├── profile/           # Profile screens
│   ├── settings/          # Settings screens
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Splash/redirect screen
├── components/            # Reusable components
├── constants/             # Color tokens and constants
├── context/              # React contexts (Auth, Cart)
├── data/                 # Mock data
├── hooks/                # Custom hooks
├── assets/               # Images and static assets
├── app.json              # Expo configuration
├── babel.config.js       # Babel configuration
├── metro.config.js       # Metro bundler configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Available Scripts

- `pnpm start` - Start Expo development server
- `pnpm web` - Start on web browser
- `pnpm android` - Start on Android emulator
- `pnpm ios` - Start on iOS simulator
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm build` - Create production build

## Tech Stack

- **Framework**: Expo SDK 54 / React Native
- **Routing**: Expo Router (file-based)
- **UI**: React Native (StyleSheet)
- **Icons**: Feather Icons (@expo/vector-icons)
- **State**: React Context + AsyncStorage
- **TypeScript**: Full type safety

## Notes

- This is a local development setup (not Replit-dependent)
- All Replit environment variables have been removed
- Uses standard Expo development workflow
- Mock authentication (accepts any email/password)
- All data is hardcoded in mockData.ts
