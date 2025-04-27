import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChooseImgScreen from './src/screen/ChooseImgScreen'; // Import ChooseImgScreen
import PdfListScreen from './src/screen/PdfListScreen';     // Import PdfListScreen
import ExtractedTextScreen from './src/screen/ExtractedTextScreen'; // Import ExtractedTextScreen
import SimpleTextEditorScreen from './src/screen/SimpleTextEditorScreen'; // Import SimpleTextEditorScreen
import TestRichEditor from './src/components/TestRichEditor'; // Import TestRichEditor
import CustomSplashScreen from './src/screen/SplashScreen';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import SplashScreen from 'react-native-splash-screen';

// Define navigation stack param types
export type RootStackParamList = {
  ChooseImg: undefined;
  PdfList: undefined;
  ExtractedText: { imageUri?: string, extractedText?: string };
  SimpleTextEditor: { initialText?: string };
  TestRichEditor: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Request permissions after splash screen
    const permissionTimer = setTimeout(() => {
      requestPermissions();
    }, 3000); // Wait for splash screen to finish

    return () => clearTimeout(permissionTimer);
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        // For Android 11+ (API 30+)
        if (Platform.Version >= 30) {
          // For managing all files (scoped storage)
          const result = await check('android.permission.MANAGE_EXTERNAL_STORAGE' as any);
          
          if (result !== RESULTS.GRANTED) {
            // Don't request permission immediately, just log it
            console.log('MANAGE_EXTERNAL_STORAGE permission not granted');
            // Set permissions as granted anyway to avoid blocking the app
            setPermissionsGranted(true);
            return;
          }
        } 
        
        // For Android 10 and below, check read/write permissions
        const readResult = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        const writeResult = await check(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        
        if (readResult === RESULTS.GRANTED && writeResult === RESULTS.GRANTED) {
          console.log('Storage permissions granted');
          setPermissionsGranted(true);
        } else {
          // Don't show alert, just log and continue
          console.log('Storage permissions not granted');
          // Set permissions as granted anyway to avoid blocking the app
          setPermissionsGranted(true);
        }
      } else {
        // For iOS (simplified for this example)
        setPermissionsGranted(true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Don't show alert on error, just continue
      setPermissionsGranted(true);
    } finally {
      setLoading(false);
      setShowSplash(false);
    }
  };

  const showPermissionAlert = () => {
    Alert.alert(
      'Permissions Required',
      'This app needs storage access permissions to function properly. Please grant these permissions in settings.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
        { 
          text: 'Open Settings', 
          onPress: () => {
            openSettings().catch(() => console.log('Cannot open settings'));
            setLoading(false);
          } 
        }
      ]
    );
  };

  if (showSplash) {
    return <CustomSplashScreen />;
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ChooseImg">
        <Stack.Screen 
          name="ChooseImg" 
          component={ChooseImgScreen} 
          options={{ 
            title: 'MANGAL SCANNER',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 20,
              color: '#4285F4'
            }
          }} 
        />
        <Stack.Screen 
          name="PdfList" 
          component={PdfListScreen} 
          options={{ 
            title: 'PDF LIST',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 20,
              color: '#4285F4'
            }
          }} 
        />
        <Stack.Screen 
          name="ExtractedText" 
          component={ExtractedTextScreen} 
          options={{ 
            title: 'EXTRACTED TEXT',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 20,
              color: '#4285F4'
            }
          }} 
        />
        <Stack.Screen 
          name="SimpleTextEditor" 
          component={SimpleTextEditorScreen} 
          options={{ 
            title: 'TEXT EDITOR',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 20,
              color: '#4285F4'
            }
          }} 
        />
        <Stack.Screen 
          name="TestRichEditor" 
          component={TestRichEditor} 
          options={{ 
            title: 'TEST RICH EDITOR',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 20,
              color: '#4285F4'
            }
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4285F4',
  },
});

export default App;