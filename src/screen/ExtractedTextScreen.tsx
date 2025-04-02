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
      
      // Target external path for final PDF storage
      const downloadsPath = getDownloadsFolderPath();
      
      try {
        // Check if Scanner directory exists
        const exists = await RNFS.exists(downloadsPath);
        
        if (!exists) {
          // Create Scanner directory if it doesn't exist
          await RNFS.mkdir(downloadsPath);
          console.log(`Created directory: ${downloadsPath}`);
        }
      } catch (dirError) {
        console.error('Error checking/creating directory:', dirError);
        // Continue anyway as we'll attempt the file operation
      }
      
      // Create a PDF from the extracted text
      const timestamp = Date.now();
      const fileName = `Extracted_Text_${timestamp}`;
      
      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Extracted Text</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; font-size: 24px; }
              p { line-height: 1.5; font-size: 14px; }
              .timestamp { color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>Extracted Text</h1>
            <p>${extractedText.replace(/\n/g, '<br/>')}</p>
            <p class="timestamp">Generated on: ${new Date().toLocaleString()}</p>
          </body>
        </html>
      `;
      
      // Step 1: Generate PDF file in the app's private directory
      const options = {
        html: htmlContent,
        fileName: fileName,
        // Don't specify directory to use default app directory
        width: 595, // A4 width in points
        height: 842, // A4 height in points
      };
      
      const pdf = await RNHTMLtoPDF.convert(options);
      
      if (pdf && pdf.filePath) {
        console.log(`Temporary PDF created at: ${pdf.filePath}`);
        
        // Step 2: Copy the file to the external non-scoped location
        const targetPath = `${downloadsPath}/${fileName}.pdf`;
        
        // Copy the file from app directory to external directory
        await RNFS.copyFile(pdf.filePath, targetPath);
        console.log(`PDF copied to external location: ${targetPath}`);
        
        // Optional: Delete the original file to clean up
        await RNFS.unlink(pdf.filePath).catch(e => 
          console.log('Error deleting temporary file:', e)
        );
        
        // Show success message with the external path
        Alert.alert(
          'PDF Exported',
          `PDF has been saved to:\n${targetPath}`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF. Please check storage permissions and try again.');
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
      
      // Target external path for final PDF storage
      const downloadsPath = getDownloadsFolderPath();
      
      try {
        // Check if Scanner directory exists
        const exists = await RNFS.exists(downloadsPath);
        
        if (!exists) {
          // Create Scanner directory if it doesn't exist
          await RNFS.mkdir(downloadsPath);
          console.log(`Created directory: ${downloadsPath}`);
        }
      } catch (dirError) {
        console.error('Error checking/creating directory:', dirError);
        // Continue anyway as we'll attempt the file operation
      }
      
      // Set the correct font path - Android assets are directly accessible with this path format
      const fontPath = 'fonts/Mangal.ttf';
      const fontDest = `${RNFS.CachesDirectoryPath}/Mangal.ttf`;
      
      try {
        // Use correct method to copy from assets folder
        await RNFS.copyFileAssets(fontPath, fontDest);
        console.log(`Font copied to: ${fontDest}`);
      } catch (fontError) {
        console.error('Error copying font file:', fontError, 'Path tried:', fontPath);
        // Try alternate path
        try {
          const alternatePath = 'Mangal.ttf';
          await RNFS.copyFileAssets(alternatePath, fontDest);
          console.log(`Font copied using alternate path: ${alternatePath}`);
        } catch (altError) {
          console.error('Also failed with alternate path:', altError);
        }
      }
      
      // Check if the font was actually copied
      const fontExists = await RNFS.exists(fontDest);
      console.log('Font file exists at destination:', fontExists);
      
      // Create a PDF from the extracted text
      const timestamp = Date.now();
      const fileName = `Hindi_Extracted_Text_${timestamp}`;
      
      // Create HTML content for PDF with Mangal font - using data URI approach for better compatibility
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>हिंदी निकाला गया पाठ</title>
            <style>
              @font-face {
                font-family: 'Mangal';
                src: url('file://${fontDest}');
                font-weight: normal;
                font-style: normal;
              }
              
              body { 
                font-family: 'Mangal', Arial, sans-serif; 
                margin: 20px; 
              }
              h1 { 
                color: #333; 
                font-size: 24px; 
                font-family: 'Mangal', Arial, sans-serif;
              }
              p { 
                line-height: 1.5; 
                font-size: 14px; 
                font-family: 'Mangal', Arial, sans-serif;
              }
              .timestamp { 
                color: #666; 
                font-size: 12px; 
                margin-top: 20px; 
                font-family: Arial, sans-serif;
              }
            </style>
          </head>
          <body>
            <h1>हिंदी निकाला गया पाठ</h1>
            <p>${extractedText.replace(/\n/g, '<br/>')}</p>
            <p class="timestamp">उत्पन्न: ${new Date().toLocaleString('hi-IN')}</p>
          </body>
        </html>
      `;
      
      // Step 1: Generate PDF file in the app's private directory
      const options = {
        html: htmlContent,
        fileName: fileName,
        // Don't specify directory to use default app directory
        width: 595, // A4 width in points
        height: 842, // A4 height in points
        base64: false,
        fonts: [fontDest] // Add the font explicitly to the options
      };
      
      const pdf = await RNHTMLtoPDF.convert(options);
      
      if (pdf && pdf.filePath) {
        console.log(`Temporary Hindi PDF created at: ${pdf.filePath}`);
        
        // Step 2: Copy the file to the external non-scoped location
        const targetPath = `${downloadsPath}/${fileName}.pdf`;
        
        // Copy the file from app directory to external directory
        await RNFS.copyFile(pdf.filePath, targetPath);
        console.log(`Hindi PDF copied to external location: ${targetPath}`);
        
        // Optional: Delete the temporary file to clean up
        await RNFS.unlink(pdf.filePath).catch(e => 
          console.log('Error deleting temporary file:', e)
        );
        
        // Optionally delete the temporary font file
        await RNFS.unlink(fontDest).catch(e => 
          console.log('Error deleting temporary font file:', e)
        );
        
        // Show success message with the external path
        Alert.alert(
          'हिंदी PDF निर्यात',
          `PDF यहां सहेजा गया है:\n${targetPath}`,
          [{ text: 'ठीक है' }]
        );
      } else {
        throw new Error('Failed to generate Hindi PDF');
      }
    } catch (error) {
      console.error('Error exporting Hindi PDF:', error);
      Alert.alert('त्रुटि', 'PDF निर्यात करने में विफल. कृपया स्टोरेज अनुमतियां जांचें और पुनः प्रयास करें.');
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