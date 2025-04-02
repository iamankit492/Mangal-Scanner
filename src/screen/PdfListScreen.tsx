import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Linking, Platform } from 'react-native';
import * as ScopedStorage from 'react-native-scoped-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App'; // Import type from App
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PdfList'>;

interface FileItem {
  name: string;
  path: string;
  uri: string;
  isDirectory: boolean;
}

const PdfListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Automatically list PDFs from Downloads/Scanner when the screen loads
  useEffect(() => {
    listPdfs();
  }, []);

  // Function to list PDFs in Downloads/Scanner
  const listPdfs = async () => {
    try {
      setIsLoading(true);
      // Open document tree and pre-select Downloads (user must confirm)
      const result = await ScopedStorage.openDocumentTree(true);
      if (!result || !result.uri) {
        Alert.alert('Error', 'No directory selected');
        return;
      }

      // List all files in the selected directory
      const filesList = await ScopedStorage.listFiles(result.uri);
      console.log("Selected directory:", result.uri);
      
      // Filter for PDFs in Downloads/Scanner (assuming user selects Downloads)
      const scannerFolderUri = `${result.uri}/Scanner`; // Hypothetical URI for Downloads/Scanner
      let pdfFiles: FileItem[] = [];

      // If Scanner folder exists, list its files
      try {
        const scannerFiles = await ScopedStorage.listFiles(scannerFolderUri);
        pdfFiles = scannerFiles
          .filter((file) => file.name.toLowerCase().endsWith('.pdf') && file.type !== 'directory')
          .map((file) => ({
            name: file.name,
            path: file.path,
            uri: file.uri,
            isDirectory: false,
          }));
      } catch (e) {
        console.log('Scanner folder not found, listing all PDFs in Downloads');
        pdfFiles = filesList
          .filter((file) => file.name.toLowerCase().endsWith('.pdf') && file.type !== 'directory')
          .map((file) => ({
            name: file.name,
            path: file.path,
            uri: file.uri,
            isDirectory: false,
          }));
      }

      setFiles(pdfFiles);
    } catch (error) {
      console.error('Error listing PDFs:', error);
      Alert.alert('Error', 'Failed to list PDFs');
    } finally {
      setIsLoading(false);
    }
  };

  // Open PDF file in file manager first
  const handleOpenPDF = async (item: FileItem) => {
    try {
      console.log("Opening file in file manager:", item.uri, item.name);
      
      if (!item.uri) {
        Alert.alert('Error', 'Invalid file URI');
        return;
      }
      
      // Show loading indicator
      setIsLoading(true);
      
      if (Platform.OS === 'android') {
        try {
          // Use intent action to view document with category browsable
          // This will typically open in a file manager or file browser rather than directly in a viewer
          
          // First, attempt to extract the document ID from the content URI
          const documentId = item.uri.split('/document/')[1];
          if (documentId) {
            // Create a special URI that tries to open the folder containing this document
            // Add parameters to encourage browsing rather than direct opening
            const browseUri = `${item.uri}?mode=browse&intent=true`;
            console.log("Attempting to browse with URI:", browseUri);
            
            const supported = await Linking.canOpenURL(browseUri);
            if (supported) {
              await Linking.openURL(browseUri);
              setIsLoading(false);
              return;
            }
          }
        } catch (folderError) {
          console.error("Error with browse intent:", folderError);
        }
        
        // Alternative: try to use a generic file manager intent
        try {
          const fileManagerUri = "content://com.android.externalstorage.documents/root/primary";
          console.log("Trying generic file manager:", fileManagerUri);
          
          const supported = await Linking.canOpenURL(fileManagerUri);
          if (supported) {
            await Linking.openURL(fileManagerUri);
            setIsLoading(false);
            return;
          }
        } catch (genericError) {
          console.error("Error opening generic file manager:", genericError);
        }
      }
      
      // Fallback: open the file directly
      console.log("Falling back to opening file directly");
      const supported = await Linking.canOpenURL(item.uri);
      
      if (!supported) {
        Alert.alert(
          'Cannot Open File',
          'No app available to open this file. Please install a file manager or PDF viewer app.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
        return;
      }
      
      // Open the content URI with default handler
      await Linking.openURL(item.uri);
      
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert(
        'Cannot Open File',
        'Could not open this file. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Delete PDF file
  const handleDeletePDF = async (item: FileItem) => {
    Alert.alert(
      'Delete PDF',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await ScopedStorage.deleteFile(item.uri);
              // Update the list after deletion
              setFiles(prevFiles => 
                prevFiles.filter(file => file.uri !== item.uri)
              );
              Alert.alert('Success', 'File deleted successfully');
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file');
            }
          }
        }
      ]
    );
  };

  // Render each PDF item
  const renderFileItem = ({ item }: { item: FileItem }) => (
    <View style={styles.fileItem}>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{item.name}</Text>
        <Text style={styles.filePath} numberOfLines={1}>{item.path}</Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.openButton]} 
          onPress={() => handleOpenPDF(item)}
        >
          <MaterialIcons name="visibility" size={20} color="#fff" />
          <Text style={styles.buttonText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.deleteButton]} 
          onPress={() => handleDeletePDF(item)}
        >
          <MaterialIcons name="delete" size={20} color="#fff" />
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PDF Files in Downloads/Scanner</Text>
      <FlatList
        data={files}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.uri}
        style={styles.fileList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isLoading ? 'Loading...' : 'No PDFs found in Downloads/Scanner'}
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  fileList: { flex: 1 },
  fileItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    flexDirection: 'column'
  },
  fileInfo: {
    marginBottom: 10
  },
  fileName: { 
    fontSize: 16, 
    marginBottom: 4,
    fontWeight: '500' 
  },
  filePath: { 
    fontSize: 12, 
    color: '#666' 
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10
  },
  openButton: {
    backgroundColor: '#4285F4'
  },
  deleteButton: {
    backgroundColor: '#F44336'
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4
  },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
});

export default PdfListScreen; // Export for use in App.tsx 