import { Platform, View } from 'react-native';

// This is a cross-platform tab bar background.
// On iOS, standard Expo apps often use a BlurView here, 
// but a simple white view works perfectly for now and prevents the crash.
export default function TabBarBackground() {
  return (
    <View 
      style={{ 
        flex: 1, 
        backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.9)' : '#fff' 
      }} 
    />
  );
}