import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Linking, Platform } from 'react-native';
import * as ScopedStorage from 'react-native-scoped-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App'; // Import type from App
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import Share from 'react-native-share';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PdfList'>;

interface FileItem {
  name: string;
  path: string;
  uri: string;
  isDirectory: boolean;
  tempPath?: string; // Add tempPath to store cached file location
}

const PdfListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFileUri, setLoadingFileUri] = useState<string | null>(null);
  const [hasStoragePermission, setHasStoragePermission] = useState<boolean>(true);

  // Automatically list PDFs from Downloads/Scanner when the screen loads
  useEffect(() => {
    // Add a small delay to ensure Activity is attached
    const timer = setTimeout(() => {
      listPdfs();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Check permissions on component mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (Platform.OS !== 'android') return;
    
    // Skip permission check for Android 10+ (API 29+)
    if (Platform.Version >= 29) {
      setHasStoragePermission(true);
      return;
    }

    try {
      const result = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      if (result === RESULTS.GRANTED) {
        setHasStoragePermission(true);
        return;
      }

      const requestResult = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      setHasStoragePermission(requestResult === RESULTS.GRANTED);
      
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert(
          'Permission Required',
          'Storage permission is required to access PDFs on this device. Please grant it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasStoragePermission(false);
    }
  };

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

  // Function to prepare file for viewing
  const prepareFileForViewing = async (item: FileItem): Promise<string> => {
    if (item.tempPath && await RNFS.exists(item.tempPath)) {
      return item.tempPath;
    }

    const tempPath = `${RNFS.TemporaryDirectoryPath}/${Date.now()}_${item.name}`;
    const fileData = await ScopedStorage.readFile(item.uri, 'base64');
    await RNFS.writeFile(tempPath, fileData, 'base64');
    
    // Update the file item with tempPath
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.uri === item.uri ? { ...file, tempPath } : file
      )
    );
    
    return tempPath;
  };

  const handleOpenPDF = async (item: FileItem) => {
    if (!hasStoragePermission && Platform.OS === 'android' && Platform.Version < 29) {
      Alert.alert(
        'Permission Required',
        'Storage permission is required to open PDFs. Please grant it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    try {
      setLoadingFileUri(item.uri);
      const filePath = await prepareFileForViewing(item);

      try {
        await FileViewer.open(filePath);
        console.log('PDF opened successfully with FileViewer');
      } catch (viewerError) {
        console.log('FileViewer failed, trying alternative methods:', viewerError);
        
        // Try to open with system PDF viewer
        const supported = await Linking.canOpenURL(item.uri);
        if (!supported) {
          Alert.alert(
            'No PDF Viewer',
            'Please install a PDF viewer app (e.g., Google PDF Viewer) to open this file.',
            [{ text: 'OK' }]
          );
          return;
        }
        await Linking.openURL(item.uri);
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert(
        'Error',
        'Could not open the PDF. Please try again or install a PDF viewer app.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingFileUri(null);
    }
  };

  const handleSharePDF = async (item: FileItem) => {
    if (!hasStoragePermission && Platform.OS === 'android' && Platform.Version < 29) {
      Alert.alert(
        'Permission Required',
        'Storage permission is required to share PDFs. Please grant it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    try {
      setLoadingFileUri(item.uri);
      const filePath = await prepareFileForViewing(item);

      const shareOptions = {
        title: `Share ${item.name}`,
        url: `file://${filePath}`,
        type: 'application/pdf',
      };

      await Share.open(shareOptions);
      console.log('PDF shared successfully');
    } catch (error: any) {
      console.error('Error sharing PDF:', error);
      if (error.message?.includes('User did not share')) {
        // User cancelled sharing, no need to show error
        return;
      }
      Alert.alert(
        'Error',
        'Could not share the PDF. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingFileUri(null);
    }
  };

  const handleDeletePDF = async (item: FileItem) => {
    if (!hasStoragePermission && Platform.OS === 'android' && Platform.Version < 29) {
      Alert.alert(
        'Permission Required',
        'Storage permission is required to delete PDFs. Please grant it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

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
              setLoadingFileUri(item.uri);
              await ScopedStorage.deleteFile(item.uri);
              
              // Clean up temporary file if it exists
              if (item.tempPath) {
                try {
                  await RNFS.unlink(item.tempPath);
                } catch (unlinkError) {
                  console.error('Error cleaning up temp file:', unlinkError);
                }
              }
              
              setFiles(prevFiles => prevFiles.filter(file => file.uri !== item.uri));
              Alert.alert('Success', 'File deleted successfully');
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert(
                'Error',
                'Failed to delete the file. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setLoadingFileUri(null);
            }
          },
        },
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
          disabled={loadingFileUri === item.uri}
        >
          <MaterialIcons name="visibility" size={20} color="#fff" />
          <Text style={styles.buttonText}>
            {loadingFileUri === item.uri ? 'Opening...' : 'Open'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.shareButton]} 
          onPress={() => handleSharePDF(item)}
          disabled={loadingFileUri === item.uri}
        >
          <MaterialIcons name="share" size={20} color="#fff" />
          <Text style={styles.buttonText}>
            {loadingFileUri === item.uri ? 'Sharing...' : 'Share'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.deleteButton]} 
          onPress={() => handleDeletePDF(item)}
          disabled={loadingFileUri === item.uri}
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
  shareButton: {
    backgroundColor: '#333'
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