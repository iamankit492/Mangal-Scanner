import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChooseImgScreen from './src/screen/ChooseImgScreen'; // Import ChooseImgScreen
import PdfListScreen from './src/screen/PdfListScreen';     // Import PdfListScreen
import ExtractedTextScreen from './src/screen/ExtractedTextScreen'; // Import ExtractedTextScreen
import CustomSplashScreen from './src/screen/SplashScreen';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import SplashScreen from 'react-native-splash-screen';

// Define navigation stack param types
export type RootStackParamList = {
  ChooseImg: undefined;
  PdfList: undefined;
  ExtractedText: { imageUri?: string, extractedText?: string };
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
            const permissionResult = await request('android.permission.MANAGE_EXTERNAL_STORAGE' as any);
            
            if (permissionResult !== RESULTS.GRANTED) {
              showPermissionAlert();
              return;
            }
          }
        } 
        
        // For Android 10 and below, request read/write permissions
        const readResult = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        const writeResult = await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        
        if (readResult === RESULTS.GRANTED && writeResult === RESULTS.GRANTED) {
          console.log('Storage permissions granted');
          setPermissionsGranted(true);
        } else {
          showPermissionAlert();
        }
      } else {
        // For iOS (simplified for this example)
        setPermissionsGranted(true);
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      showPermissionAlert();
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