import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useRoute, RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
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

// Function to sanitize file names
const sanitizeFileName = (name: string) => {
  // Remove invalid characters and trim spaces
  let sanitized = name.replace(/[\/:*?"<>|]/g, '').trim();
  // Ensure it ends with .pdf
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    sanitized += '.pdf';
  }
  // Return sanitized name or default if empty
  return sanitized || 'default.pdf';
};

const ExtractedTextScreen: React.FC = () => {
  const route = useRoute<ExtractedTextScreenRouteProp>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { extractedText, imageUri } = route.params;
  const [isExportingEnglish, setIsExportingEnglish] = useState(false);
  const [isExportingHindi, setIsExportingHindi] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const [defaultFileName, setDefaultFileName] = useState('');
  const [isHindiExport, setIsHindiExport] = useState(false);

  // Navigate to PdfList screen
  const goToPdfList = () => {
    navigation.navigate('PdfList');
  };

  // Function to show the file name prompt
  const showFileNamePrompt = (isHindi: boolean) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = isHindi
      ? `extracted_text_hindi_${timestamp}.pdf`
      : `extracted_text_${timestamp}.pdf`;
    setDefaultFileName(defaultName);
    setFileNameInput(defaultName);
    setIsHindiExport(isHindi);
    setIsModalVisible(true);
  };

  // Handle modal save
  const handleModalSave = async () => {
    if (!extractedText) {
      Alert.alert('Error', 'No text to export');
      setIsModalVisible(false);
      return;
    }

    const finalFileName = sanitizeFileName(fileNameInput || defaultFileName);
    setIsModalVisible(false);

    try {
      if (isHindiExport) {
        setIsExportingHindi(true);
        await exportPDF(finalFileName, true);
      } else {
        setIsExportingEnglish(true);
        await exportPDF(finalFileName, false);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExportingEnglish(false);
      setIsExportingHindi(false);
    }
  };

  // Core export function
  const exportPDF = async (fileName: string, isHindi: boolean) => {
    const downloadsPath = getDownloadsFolderPath();
    const filePath = `${downloadsPath}/${fileName}`;

    // Check if directory exists, if not create it
    const dirExists = await RNFS.exists(downloadsPath);
    if (!dirExists) {
      await RNFS.mkdir(downloadsPath);
    }

    let htmlContent = '';
    let options: any = {
      html: '',
      fileName: fileName.replace(/\.pdf$/, ''), // Remove .pdf for RNHTMLtoPDF
    };

    if (isHindi) {
      // Copy font for Hindi
      const fontDest = `${RNFS.CachesDirectoryPath}/Mangal.ttf`;
      try {
        await RNFS.copyFileAssets('fonts/Mangal.ttf', fontDest);
        console.log('Font copied successfully');
      } catch (fontError) {
        console.error('Error copying font:', fontError);
        try {
          await RNFS.copyFileAssets('Mangal.ttf', fontDest);
          console.log('Font copied successfully with alternate path');
        } catch (altFontError) {
          console.error('Error copying font with alternate path:', altFontError);
        }
      }

      const fontExists = await RNFS.exists(fontDest);
      console.log('Font exists at destination:', fontExists);

      htmlContent = `
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
                margin: 60px;
                text-align: justify;
              }
              .content {
                text-align: center;
                margin-bottom: 20px;
                padding: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background-color: #ffffff;
              }
              .text {
                text-align: justify;
                margin-top: 20px;
                padding: 0 10px;
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
      options = {
        html: htmlContent,
        fileName: fileName.replace(/\.pdf$/, ''),
        fonts: [fontDest],
      };
    } else {
      htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                margin: 60px;
                text-align: justify;
              }
              .content {
                text-align: center;
                margin-bottom: 20px;
                padding: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background-color: #ffffff;
              }
              .text {
                text-align: justify;
                margin-top: 20px;
                padding: 0 10px;
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
      options = {
        html: htmlContent,
        fileName: fileName.replace(/\.pdf$/, ''),
      };
    }

    try {
      const pdf = await RNHTMLtoPDF.convert(options);
      if (pdf.filePath) {
        // Move PDF to Download/Scanner
        await RNFS.moveFile(pdf.filePath, filePath);
        Alert.alert('Success', `PDF saved to Scanner/${fileName}`);
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  const handleExportEnglish = () => {
    showFileNamePrompt(false);
  };

  const handleExportHindi = () => {
    showFileNamePrompt(true);
  };

  // Navigate to SimpleTextEditor screen
  const goToSimpleTextEditor = () => {
    if (!extractedText) {
      Alert.alert('Error', 'No text available to edit');
      return;
    }
    
    try {
      console.log('Attempting to navigate to SimpleTextEditor with text:', extractedText.substring(0, 50) + '...');
      navigation.navigate('SimpleTextEditor', {
        initialText: extractedText || ''
      });
      console.log('Navigation to SimpleTextEditor completed');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to open text editor: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Navigate to TestRichEditor screen
  const goToTestRichEditor = () => {
    try {
      console.log('Attempting to navigate to TestRichEditor');
      navigation.navigate('TestRichEditor');
      console.log('Navigation to TestRichEditor completed');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to open test rich editor: ' + (error instanceof Error ? error.message : String(error)));
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
          <MaterialIcons name="folder" size={20} color="#fff" />
          <Text style={styles.pdfButtonText}>PDF List</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Scrollable Text Box */}
        <ScrollView style={[styles.textContainer, { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }]}>
          {extractedText ? (
            <Text style={styles.text}>{extractedText}</Text>
          ) : (
            <Text style={styles.noText}>No text was extracted from the image.</Text>
          )}
        </ScrollView>

        {/* Edit Button - Centered */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: '#2196F3', marginTop: 10, alignSelf: 'center' }]}
          onPress={goToSimpleTextEditor}
          disabled={!extractedText}
        >
          <MaterialIcons name="edit-note" size={20} color="#fff" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>

        {/* File Name Input Modal */}
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter File Name</Text>
              <TextInput
                style={styles.fileNameInput}
                value={fileNameInput}
                onChangeText={setFileNameInput}
                placeholder={defaultFileName}
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoFocus={true}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleModalSave}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    backgroundColor: '#4285F4',
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
    padding: 16,
  },
  textContainer: {
    flex: 1,
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  noText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  exportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  fileNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
});

export default ExtractedTextScreen;