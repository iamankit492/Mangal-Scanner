import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

type ExtractedTextScreenRouteProp = RouteProp<RootStackParamList, 'ExtractedText'>;

// Function to get the Downloads folder path
const getDownloadsFolderPath = () => {
  if (Platform.OS === 'android') {
    return `${RNFS.ExternalStorageDirectoryPath}/Download/Scanner`;
  }
  return RNFS.DocumentDirectoryPath; // Fallback for iOS
};

const ExtractedTextScreen: React.FC = () => {
  const route = useRoute<ExtractedTextScreenRouteProp>();
  const { extractedText, imageUri } = route.params;
  const [isExportingEnglish, setIsExportingEnglish] = useState(false);
  const [isExportingHindi, setIsExportingHindi] = useState(false);

  // Handle export to English
  const handleExportEnglish = async () => {
    if (!extractedText) {
      Alert.alert('Error', 'No text to export');
      return;
    }

    try {
      setIsExportingEnglish(true);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `extracted_text_${timestamp}.pdf`;
      const downloadsPath = getDownloadsFolderPath();
      const filePath = `${downloadsPath}/${fileName}`;

      // Check if directory exists, if not create it
      const dirExists = await RNFS.exists(downloadsPath);
      if (!dirExists) {
        await RNFS.mkdir(downloadsPath);
      }

      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                margin: 40px;
                text-align: justify;
              }
              .content {
                text-align: center;
                margin-bottom: 20px;
              }
              .text {
                text-align: justify;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="content">
              <div class="text">${extractedText}</div>
            </div>
          </body>
        </html>
      `;

      const options = {
        html: htmlContent,
        fileName: fileName,
        directory: 'Documents',
      };

      const file = await RNHTMLtoPDF.convert(options);
      await RNFS.moveFile(file.filePath, filePath);
      Alert.alert('Success', `PDF saved to Scanner/${fileName}`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExportingEnglish(false);
    }
  };

  // Handle export to Hindi
  const handleExportHindi = async () => {
    if (!extractedText) {
      Alert.alert('Error', 'No text to export');
      return;
    }

    try {
      setIsExportingHindi(true);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `extracted_text_hindi_${timestamp}.pdf`;
      const downloadsPath = getDownloadsFolderPath();
      const filePath = `${downloadsPath}/${fileName}`;

      // Check if directory exists, if not create it
      const dirExists = await RNFS.exists(downloadsPath);
      if (!dirExists) {
        await RNFS.mkdir(downloadsPath);
      }

      // Copy font from assets to a temporary location
      const fontDest = `${RNFS.CachesDirectoryPath}/Mangal.ttf`;
      try {
        await RNFS.copyFileAssets('fonts/Mangal.ttf', fontDest);
        console.log('Font copied successfully');
      } catch (fontError) {
        console.error('Error copying font:', fontError);
        // Try alternate path
        try {
          await RNFS.copyFileAssets('Mangal.ttf', fontDest);
          console.log('Font copied successfully with alternate path');
        } catch (altFontError) {
          console.error('Error copying font with alternate path:', altFontError);
        }
      }

      // Verify if font exists
      const fontExists = await RNFS.exists(fontDest);
      console.log('Font exists at destination:', fontExists);

      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @font-face {
                font-family: 'Mangal';
                src: url('data:font/ttf;base64,${await RNFS.readFile(fontDest, 'base64')}') format('truetype');
              }
              body {
                font-family: 'Mangal', Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                margin: 40px;
                text-align: justify;
              }
              .content {
                text-align: center;
                margin-bottom: 20px;
              }
              .text {
                text-align: justify;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="content">
              <div class="text">${extractedText}</div>
            </div>
          </body>
        </html>
      `;

      const options = {
        html: htmlContent,
        fileName: fileName,
        directory: 'Documents',
        fonts: [fontDest],
      };

      const file = await RNHTMLtoPDF.convert(options);
      await RNFS.moveFile(file.filePath, filePath);
      Alert.alert('Success', `PDF saved to Scanner/${fileName}`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExportingHindi(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Extracted Text</Text>
        
        {/* Scrollable Text Box */}
        <ScrollView style={styles.textContainer}>
          {extractedText ? (
            <Text style={styles.text}>{extractedText}</Text>
          ) : (
            <Text style={styles.noText}>No text was extracted from the image.</Text>
          )}
        </ScrollView>

        {/* Export Buttons */}
        <View style={styles.exportButtonsContainer}>
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#4285F4' }]} 
            onPress={handleExportEnglish}
            disabled={isExportingEnglish || isExportingHindi || !extractedText}
          >
            {isExportingEnglish ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="translate" size={20} color="#fff" />
                <Text style={styles.exportButtonText}>Export English</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#FF9800' }]} 
            onPress={handleExportHindi}
            disabled={isExportingEnglish || isExportingHindi || !extractedText}
          >
            {isExportingHindi ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="language" size={20} color="#fff" />
                <Text style={styles.exportButtonText}>Export Hindi</Text>
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
  container: {
    flex: 1,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  textContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  noText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  exportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 10,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ExtractedTextScreen; 