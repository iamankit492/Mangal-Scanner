import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Alert, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App'; // Import type from App
// Import the entire library for better compatibility
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChooseImg'>;

const ChooseImgScreen: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  // Create the icon element directly
  const fileIcon = <MaterialIcons name="folder" size={20} color="#fff" />;

  // Check and request camera permissions when component mounts
  useEffect(() => {
    checkCameraPermission();
  }, []);

  // Check camera permission
  const checkCameraPermission = async () => {
    const permission = Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.CAMERA 
      : PERMISSIONS.ANDROID.CAMERA;
    
    const result = await check(permission);
    
    if (result === RESULTS.GRANTED) {
      setCameraPermissionGranted(true);
    } else if (result === RESULTS.DENIED) {
      const requestResult = await request(permission);
      setCameraPermissionGranted(requestResult === RESULTS.GRANTED);
    } else if (result === RESULTS.BLOCKED || result === RESULTS.UNAVAILABLE) {
      Alert.alert(
        'Camera Permission Required',
        'Camera permission is required to take photos. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
    }
  };

  // Navigate to PdfList screen on button press
  const goToPdfList = () => {
    navigation.navigate('PdfList');
  };

  // Handle camera capture
  const handleCameraCapture = async () => {
    if (!cameraPermissionGranted) {
      const permissionRequested = await checkCameraPermission();
      if (!cameraPermissionGranted) {
        return;
      }
    }
    
    launchCamera({
      mediaType: 'photo',
      quality: 0.8,
    }, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.errorCode) {
        console.log('Camera error: ', response.errorMessage);
        Alert.alert('Error', response.errorMessage || 'Something went wrong');
      } else if (response.assets && response.assets.length > 0) {
        setSelectedImage(response.assets[0]);
      }
    });
  };

  // Handle gallery selection
  const handleGallerySelect = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    }, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled image selection');
      } else if (response.errorCode) {
        console.log('Image picker error: ', response.errorMessage);
        Alert.alert('Error', response.errorMessage || 'Something went wrong');
      } else if (response.assets && response.assets.length > 0) {
        setSelectedImage(response.assets[0]);
      }
    });
  };

  // Extract text from image using Google Vision API
  const extractTextFromImage = async () => {
    if (!selectedImage) {
      Alert.alert('No Image Selected', 'Please select or capture an image first.');
      return;
    }

    setExtracting(true);

    try {
      // Using Google Cloud Vision API
      const apiKey = 'AIzaSyC5_fbh1odlHmHdJRTRjKoH9lUoThc0xfk'; // Replace with your actual API key
      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

      // Get the image URI
      const imageUri = selectedImage.uri;
      
      if (!imageUri) {
        throw new Error('Invalid image URI');
      }

      // Convert image to base64 string
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            // Extract base64 data from the data URL
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
          } else {
            reject(new Error('Failed to convert image to base64'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log('Base64 image prepared, length:', base64Image.length);

      // Make request to Google Cloud Vision API
      const requestData = {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 10
              }
            ]
          }
        ]
      };
      
      // Make the actual API call
      console.log('Sending request to Google Vision API');
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      const responseJson = await apiResponse.json();
      console.log('API response received');
      
      // Extract text from response
      let extractedText = '';
      if (responseJson.responses && 
          responseJson.responses[0] && 
          responseJson.responses[0].textAnnotations && 
          responseJson.responses[0].textAnnotations[0]) {
        extractedText = responseJson.responses[0].textAnnotations[0].description;
      } else {
        extractedText = 'No text detected in the image.';
      }
      
      // Navigate to the ExtractedText screen with the extracted text
      navigation.navigate('ExtractedText', {
        imageUri: selectedImage.uri,
        extractedText: extractedText
      });
    } catch (error) {
      console.error('Error extracting text:', error);
      Alert.alert('Error', 'Failed to extract text from the image. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Bar with PDF List Button */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity 
          style={styles.pdfButton} 
          onPress={goToPdfList}
        >
          {fileIcon}
          <Text style={styles.pdfButtonText}>PDF List</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.container}>
        <Text style={styles.title}>Choose Image Screen</Text>
        
        {/* Image display box */}
        <View style={styles.imageBox}>
          {selectedImage ? (
            <Image 
              source={{ uri: selectedImage.uri }} 
              style={styles.image} 
              resizeMode="contain" 
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <MaterialIcons name="image" size={60} color="#ccc" />
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>
        
        {/* Button container */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleCameraCapture}
          >
            <MaterialIcons name="camera-alt" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Capture</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleGallerySelect}
          >
            <MaterialIcons name="photo-library" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Choose</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { backgroundColor: selectedImage ? '#4CAF50' : '#cccccc' }
            ]} 
            onPress={extractTextFromImage}
            disabled={!selectedImage || extracting}
          >
            {extracting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <MaterialIcons name="text-fields" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Extract</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  imageBox: {
    width: '100%',
    height: '80%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginVertical: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default ChooseImgScreen; // Export for use in App.tsx 