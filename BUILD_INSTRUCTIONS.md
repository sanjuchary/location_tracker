# Production Build Instructions

## Prerequisites

1. Make sure you have EAS CLI installed:
```bash
npm install -g @expo/eas-cli
```

2. Login to your Expo account:
```bash
eas login
```

3. Configure your project:
```bash
eas build:configure
```

## Building Production APK

### Method 1: Using npm scripts (Recommended)

```bash
# Build production APK
npm run build:android:production

# Build preview APK
npm run build:android:preview
```

### Method 2: Using EAS CLI directly

```bash
# Build production APK
eas build --platform android --profile production

# Build preview APK
eas build --platform android --profile preview
```

## Configuration Files

### eas.json
- Updated with production profile for APK builds
- Configured for internal distribution
- Auto-increment version enabled

### app.json
- Updated app name and slug
- Added proper Android permissions
- Configured adaptive icons
- Set version code for Android

### app.config.js
- Dynamic configuration based on environment
- Production-specific settings

## Production Build Features

1. **APK Build Type**: Configured for APK output
2. **Version Management**: Auto-increment enabled
3. **Permissions**: All necessary location and network permissions
4. **Optimization**: Production-optimized build
5. **Distribution**: Internal distribution for testing

## Build Process

1. **Validation**: EAS validates your configuration
2. **Build**: Builds your app in the cloud
3. **Signing**: Automatically signs the APK
4. **Download**: Provides download link when complete

## Troubleshooting

### Common Issues

1. **Build Fails**: Check your EAS configuration and app.json
2. **Permission Issues**: Ensure all required permissions are in app.json
3. **Version Conflicts**: Make sure version codes are properly set

### Support

- Check EAS documentation: https://docs.expo.dev/build/introduction/
- Expo Discord: https://discord.gg/expo
- EAS Status: https://status.expo.dev/

## Next Steps

After building:

1. Test the APK on different devices
2. Distribute to your team for testing
3. Upload to Google Play Store (if applicable)
4. Monitor app performance and crashes
