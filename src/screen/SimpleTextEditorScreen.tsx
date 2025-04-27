import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  PanResponder,
  Animated,
  Dimensions,
  LayoutChangeEvent,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

type SimpleTextEditorScreenRouteProp = RouteProp<RootStackParamList, 'SimpleTextEditor'>;

// Define a type for text formatting
type TextFormat = {
  start: number;
  end: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  heading: 'none' | 'h1' | 'h2' | 'h3';
  backgroundColor?: string;
  textColor?: string;
};

// Function to get the Downloads folder path
const getDownloadsFolderPath = () => {
  if (Platform.OS === 'android') {
    return `${RNFS.ExternalStorageDirectoryPath}/Download/Scanner`;
  }
  return RNFS.DocumentDirectoryPath; // Fallback for iOS
};

// Function to sanitize file name
const sanitizeFileName = (fileName: string) => {
  // Remove any characters that are not allowed in file names
  return fileName.replace(/[\\/:*?"<>|]/g, '_');
};

const SimpleTextEditorScreen: React.FC = () => {
  const route = useRoute<SimpleTextEditorScreenRouteProp>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const initialText = route.params?.initialText || '';
  const [text, setText] = useState(initialText);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [formats, setFormats] = useState<TextFormat[]>([]);
  const [currentFormat, setCurrentFormat] = useState<TextFormat>({
    start: 0,
    end: 0,
    bold: false,
    italic: false,
    underline: false,
    fontSize: 16,
    alignment: 'left',
    heading: 'none',
    backgroundColor: undefined,
    textColor: undefined,
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [textLayout, setTextLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [characterPositions, setCharacterPositions] = useState<{ x: number, y: number, width: number, height: number }[]>([]);
  const [handlePositions, setHandlePositions] = useState({ start: 0, end: 0 });
  const [showExportModal, setShowExportModal] = useState(false);
  const [editorWidth, setEditorWidth] = useState(0);
  const [isExportingEnglish, setIsExportingEnglish] = useState(false);
  const [isExportingHindi, setIsExportingHindi] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const [defaultFileName, setDefaultFileName] = useState('');
  const [isHindiExport, setIsHindiExport] = useState(false);
  
  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const selectionStartAnim = useRef(new Animated.Value(0)).current;
  const selectionEndAnim = useRef(new Animated.Value(0)).current;
  const selectionHeightAnim = useRef(new Animated.Value(20)).current;
  const webViewRef = useRef<WebView>(null);
  
  // Create pan responder for selection handles
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        // Determine if we're moving the start or end handle based on which one was touched
        const touchX = evt.nativeEvent.locationX;
        const startHandleX = handlePositions.start;
        const endHandleX = handlePositions.end;
        
        // If touch is closer to start handle, we're moving start
        const isMovingStart = Math.abs(touchX - startHandleX) < Math.abs(touchX - endHandleX);
        
        if (isMovingStart) {
          // Start selection
          setIsSelecting(true);
          setSelectionStart(selection.start);
          setSelectionEnd(selection.end);
        } else {
          // Continue selection
          setIsSelecting(true);
          setSelectionStart(selection.start);
          setSelectionEnd(selection.end);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isSelecting) return;
        
        // Calculate the new position based on gesture
        const newX = evt.nativeEvent.locationX;
        
        // Find the closest character position to the new X position
        let closestCharIndex = 0;
        let minDistance = Number.MAX_VALUE;
        
        characterPositions.forEach((pos, index) => {
          const distance = Math.abs(pos.x + pos.width / 2 - newX);
          if (distance < minDistance) {
            minDistance = distance;
            closestCharIndex = index;
          }
        });
        
        // Update the appropriate selection handle
        if (gestureState.dx < 0) {
          // Moving left - update start handle
          const newStart = Math.min(closestCharIndex, selectionEnd);
          setSelectionStart(newStart);
          const newStartX = characterPositions[newStart]?.x || 0;
          selectionStartAnim.setValue(newStartX);
          setHandlePositions(prev => ({ ...prev, start: newStartX }));
        } else {
          // Moving right - update end handle
          const newEnd = Math.max(closestCharIndex, selectionStart);
          setSelectionEnd(newEnd);
          const newEndX = characterPositions[newEnd]?.x || 0;
          selectionEndAnim.setValue(newEndX);
          setHandlePositions(prev => ({ ...prev, end: newEndX }));
        }
        
        // Update the selection state
        setSelection({
          start: Math.min(selectionStart, selectionEnd),
          end: Math.max(selectionStart, selectionEnd)
        });
      },
      onPanResponderRelease: () => {
        setIsSelecting(false);
        
        // Update the current format based on the new selection
        const newSelection = {
          start: Math.min(selectionStart, selectionEnd),
          end: Math.max(selectionStart, selectionEnd)
        };
        
        // Find if there's an existing format for this selection
        const existingFormat = formats.find(format => 
          format.start === newSelection.start && format.end === newSelection.end
        );
        
        if (existingFormat) {
          setCurrentFormat(existingFormat);
        } else {
          // Reset to default format for new selection
          setCurrentFormat({
            start: newSelection.start,
            end: newSelection.end,
            bold: false,
            italic: false,
            underline: false,
            fontSize: 16,
            alignment: 'left',
            heading: 'none',
            backgroundColor: undefined,
            textColor: undefined,
          });
        }
      }
    })
  ).current;

  // Log when component mounts
  useEffect(() => {
    console.log('SimpleTextEditorScreen mounted');
    console.log('Initial text:', initialText);
    
    return () => {
      console.log('SimpleTextEditorScreen unmounted');
    };
  }, [initialText]);

  // Handle text layout changes
  const handleTextLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setTextLayout({ x, y, width, height });
    
    // Calculate character positions
    if (text.length > 0) {
      // This is a simplified approach - in a real app, you'd need more sophisticated
      // text measurement to get exact character positions
      const charWidth = width / text.length;
      const positions = text.split('').map((_, index) => ({
        x: x + index * charWidth,
        y: y,
        width: charWidth,
        height: height
      }));
      setCharacterPositions(positions);
    }
  };

  // Handle editor layout changes
  const handleEditorLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setEditorWidth(width);
  };

  // Handle text change
  const handleTextChange = (newText: string) => {
    // Get the current selection
    const { start, end } = selection;
    
    // If text was deleted (new text is shorter than old text)
    if (newText.length < text.length) {
      // Calculate how many characters were deleted
      const deletedLength = text.length - newText.length;
      
      // Find the position where the deletion occurred
      let deletionStart = start;
      let deletionEnd = end;
      
      // If selection is at the end of text, deletion happened before the selection
      if (start === text.length && end === text.length) {
        deletionStart = Math.max(0, text.length - deletedLength);
        deletionEnd = text.length;
      }
      
      // Update formats to handle the deletion
      const updatedFormats = formats.map(format => {
        // If format is completely before the deletion, keep it unchanged
        if (format.end <= deletionStart) {
          return format;
        }
        
        // If format is completely within the deletion, remove it
        if (format.start >= deletionStart && format.end <= deletionEnd) {
          return null;
        }
        
        // If format spans the deletion
        if (format.start < deletionStart && format.end > deletionEnd) {
          // Adjust the end position
          return {
            ...format,
            end: format.end - deletedLength
          };
        }
        
        // If format starts within the deletion
        if (format.start >= deletionStart && format.start < deletionEnd) {
          // Adjust the start position to the deletion start
          return {
            ...format,
            start: deletionStart,
            end: Math.max(deletionStart, format.end - deletedLength)
          };
        }
        
        // If format ends within the deletion
        if (format.end > deletionStart && format.end <= deletionEnd) {
          // Adjust the end position to the deletion start
          return {
            ...format,
            end: deletionStart
          };
        }
        
        // If format is completely after the deletion
        if (format.start > deletionEnd) {
          // Shift the format by the deleted length
          return {
            ...format,
            start: format.start - deletedLength,
            end: format.end - deletedLength
          };
        }
        
        return format;
      }).filter(format => format !== null) as TextFormat[];
      
      setFormats(updatedFormats);
    }
    
    // Update the text
    setText(newText);
  };

  // Handle selection change from TextInput
  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const { start, end } = event.nativeEvent.selection;
    setSelection({ start, end });
    
    // Update selection handles position
    if (characterPositions.length > 0) {
      const startX = characterPositions[start]?.x || 0;
      const endX = characterPositions[end]?.x || 0;
      
      selectionStartAnim.setValue(startX);
      selectionEndAnim.setValue(endX);
      setHandlePositions({ start: startX, end: endX });
    }
    
    // Find if there's an existing format for this selection
    const existingFormat = formats.find(format => 
      format.start === start && format.end === end
    );
    
    if (existingFormat) {
      setCurrentFormat(existingFormat);
    } else {
      // Reset to default format for new selection
      setCurrentFormat({
        start,
        end,
        bold: false,
        italic: false,
        underline: false,
        fontSize: 16,
        alignment: 'left',
        heading: 'none',
        backgroundColor: undefined,
        textColor: undefined,
      });
    }
  };

  // Apply formatting to selected text
  const applyFormatting = (property: keyof Omit<TextFormat, 'start' | 'end'>, value: any) => {
    if (selection.start === selection.end) {
      // No text selected, just update current format
      setCurrentFormat(prev => ({
        ...prev,
        [property]: value
      }));
      return;
    }

    // Check if there's an existing format for this selection
    const existingFormatIndex = formats.findIndex(format => 
      format.start === selection.start && format.end === selection.end
    );

    if (existingFormatIndex >= 0) {
      // Update existing format
      const updatedFormats = [...formats];
      const existingFormat = updatedFormats[existingFormatIndex];
      
      // If the property value is the same as what we're trying to set, remove the format
      if (existingFormat[property] === value) {
        // Remove this format
        updatedFormats.splice(existingFormatIndex, 1);
        setFormats(updatedFormats);
        
        // Reset current format for this property
        setCurrentFormat(prev => ({
          ...prev,
          [property]: property === 'bold' ? false : 
                      property === 'italic' ? false : 
                      property === 'underline' ? false : 
                      property === 'alignment' ? 'left' : 
                      property === 'heading' ? 'none' : 
                      property === 'fontSize' ? 16 : prev[property]
        }));
      } else {
        // Update the format with the new value
        updatedFormats[existingFormatIndex] = {
          ...existingFormat,
          [property]: value
        };
        setFormats(updatedFormats);
        setCurrentFormat(updatedFormats[existingFormatIndex]);
      }
    } else {
      // Create new format
      const newFormat = {
        start: selection.start,
        end: selection.end,
        bold: currentFormat.bold,
        italic: currentFormat.italic,
        underline: currentFormat.underline,
        fontSize: currentFormat.fontSize,
        alignment: currentFormat.alignment,
        heading: currentFormat.heading,
        backgroundColor: currentFormat.backgroundColor,
        textColor: currentFormat.textColor,
        [property]: value
      };
      setFormats([...formats, newFormat]);
      setCurrentFormat(newFormat);
    }
    
    // Maintain selection after formatting
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.setNativeProps({
          selection: {
            start: selection.start,
            end: selection.end
          }
        });
      }
    }, 50);
  };

  // Apply justify alignment using WebView
  const applyJustifyAlignment = () => {
    if (webViewRef.current) {
      // Inject JavaScript to apply justify alignment
      webViewRef.current.injectJavaScript(`
        document.execCommand('justifyFull', false, null);
        true;
      `);
    }
  };

  // Toggle bold
  const toggleBold = () => {
    applyFormatting('bold', !currentFormat.bold);
  };

  // Toggle italic
  const toggleItalic = () => {
    applyFormatting('italic', !currentFormat.italic);
  };

  // Toggle underline
  const toggleUnderline = () => {
    applyFormatting('underline', !currentFormat.underline);
  };

  // Set heading level
  const setHeading = (level: 'none' | 'h1' | 'h2' | 'h3') => {
    applyFormatting('heading', level);
  };

  // Increase font size
  const increaseFontSize = () => {
    applyFormatting('fontSize', Math.min(currentFormat.fontSize + 2, 32));
  };

  // Decrease font size
  const decreaseFontSize = () => {
    applyFormatting('fontSize', Math.max(currentFormat.fontSize - 2, 12));
  };

  // Set alignment
  const setTextAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (align === 'justify') {
      applyJustifyAlignment();
    }
    applyFormatting('alignment', align);
  };

  // Toggle text color
  const toggleTextColor = () => {
    applyFormatting('textColor', currentFormat.textColor ? undefined : '#0000FF');
  };

  // Toggle background color
  const toggleBackgroundColor = () => {
    applyFormatting('backgroundColor', currentFormat.backgroundColor ? undefined : '#ADD8E6');
  };

  // Save text
  const saveText = () => {
    Alert.alert('Success', 'Text saved successfully!');
    navigation.goBack();
  };

  // Get text style for a specific range
  const getTextStyleForRange = (start: number, end: number) => {
    const format = formats.find(f => f.start === start && f.end === end);
    if (!format) return {};
    
    // Base style
    const style: any = {
      fontWeight: format.bold ? 'bold' : 'normal',
      fontStyle: format.italic ? 'italic' : 'normal',
      textDecorationLine: format.underline ? 'underline' : 'none',
      fontSize: format.fontSize,
      textAlign: format.alignment,
    };

    // Apply heading styles
    if (format.heading !== 'none') {
      switch (format.heading) {
        case 'h1':
          style.fontSize = 24;
          style.fontWeight = 'bold';
          style.marginBottom = 10;
          break;
        case 'h2':
          style.fontSize = 20;
          style.fontWeight = 'bold';
          style.marginBottom = 8;
          break;
        case 'h3':
          style.fontSize = 18;
          style.fontWeight = 'bold';
          style.marginBottom = 6;
          break;
      }
    }
    
    // Apply text color
    if (format.textColor) {
      style.color = format.textColor;
    }
    
    // Apply background color
    if (format.backgroundColor) {
      style.backgroundColor = format.backgroundColor;
    }
    
    return style;
  };

  // Render text with formatting
  const renderFormattedText = () => {
    if (formats.length === 0) {
      return (
        <View style={styles.textContainer}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            value={text}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            multiline
            placeholder="Start typing..."
            placeholderTextColor="#999"
            autoFocus
          />
          
          {/* Custom selection overlay */}
          {selection.start !== selection.end && (
            <View style={styles.selectionOverlay}>
              <Animated.View 
                style={[
                  styles.selectionHandle, 
                  styles.startHandle,
                  { left: selectionStartAnim }
                ]}
                {...panResponder.panHandlers}
              />
              <Animated.View 
                style={[
                  styles.selectionHandle, 
                  styles.endHandle,
                  { left: selectionEndAnim }
                ]}
                {...panResponder.panHandlers}
              />
              <Animated.View 
                style={[
                  styles.selectionHighlight,
                  { 
                    left: selectionStartAnim,
                    width: Animated.subtract(selectionEndAnim, selectionStartAnim),
                    height: selectionHeightAnim
                  }
                ]}
              />
            </View>
          )}
        </View>
      );
    }

    // Sort formats by start position
    const sortedFormats = [...formats].sort((a, b) => a.start - b.start);
    
    // Create text segments with formatting
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    
    sortedFormats.forEach((format, index) => {
      // Add text before this format
      if (format.start > lastIndex) {
        segments.push(
          <Text key={`text-${index}`}>
            {text.substring(lastIndex, format.start)}
          </Text>
        );
      }
      
      // Add formatted text
      const formattedText = text.substring(format.start, format.end);
      const style = getTextStyleForRange(format.start, format.end);
      
      // For all alignments including justify, render normally
      segments.push(
        <Text 
          key={`format-${index}`}
          style={style}
        >
          {formattedText}
        </Text>
      );
      
      lastIndex = format.end;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(
        <Text key="text-end">
          {text.substring(lastIndex)}
        </Text>
      );
    }
    
    return (
      <View style={styles.formattedTextContainer}>
        <Text style={styles.formattedText}>
          {segments}
        </Text>
        <TextInput
          ref={textInputRef}
          style={styles.hiddenInput}
          value={text}
          onChangeText={handleTextChange}
          onSelectionChange={handleSelectionChange}
          multiline
          autoFocus
        />
        
        {/* Custom selection overlay */}
        {selection.start !== selection.end && (
          <View style={styles.selectionOverlay}>
            <Animated.View 
              style={[
                styles.selectionHandle, 
                styles.startHandle,
                { left: selectionStartAnim }
              ]}
              {...panResponder.panHandlers}
            />
            <Animated.View 
              style={[
                styles.selectionHandle, 
                styles.endHandle,
                { left: selectionEndAnim }
              ]}
              {...panResponder.panHandlers}
            />
            <Animated.View 
              style={[
                styles.selectionHighlight,
                { 
                  left: selectionStartAnim,
                  width: Animated.subtract(selectionEndAnim, selectionStartAnim),
                  height: selectionHeightAnim
                }
              ]}
            />
          </View>
        )}
      </View>
    );
  };

  // Navigate to PdfList screen
  const goToPdfList = () => {
    navigation.navigate('PdfList');
  };

  // Function to show the file name prompt
  const showFileNamePrompt = (isHindi: boolean) => {
    // Use a simple placeholder instead of a complex timestamp-based name
    const defaultName = isHindi ? 'hindi_document.pdf' : 'document.pdf';
    setDefaultFileName(defaultName);
    setFileNameInput('');
    setIsHindiExport(isHindi);
    setShowExportModal(true);
  };

  // Handle modal save
  const handleModalSave = async () => {
    if (!text) {
      Alert.alert('Error', 'No text to export');
      setShowExportModal(false);
      return;
    }

    // Add .pdf extension if not already present
    let finalFileName = fileNameInput || defaultFileName;
    if (!finalFileName.toLowerCase().endsWith('.pdf')) {
      finalFileName += '.pdf';
    }
    
    setShowExportModal(false);

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

    // Create a formatted text string based on the current text and formats
    let formattedText = '';
    
    if (formats.length === 0) {
      // No formatting, just plain text
      formattedText = text;
    } else {
      // Sort formats by start position
      const sortedFormats = [...formats].sort((a, b) => a.start - b.start);
      
      let lastIndex = 0;
      sortedFormats.forEach((format) => {
        // Add text before this format
        if (format.start > lastIndex) {
          formattedText += text.substring(lastIndex, format.start);
        }
        
        // Add formatted text
        const segment = text.substring(format.start, format.end);
        
        // Apply formatting based on the format properties
        let formattedSegment = segment;
        
        if (format.bold) formattedSegment = `<strong>${formattedSegment}</strong>`;
        if (format.italic) formattedSegment = `<em>${formattedSegment}</em>`;
        if (format.underline) formattedSegment = `<u>${formattedSegment}</u>`;
        
        // Add heading if applicable
        if (format.heading !== 'none') {
          const headingLevel = format.heading === 'h1' ? 1 : format.heading === 'h2' ? 2 : 3;
          formattedSegment = `<h${headingLevel}>${formattedSegment}</h${headingLevel}>`;
        }
        
        // Apply text color
        if (format.textColor) {
          formattedSegment = `<span style="color: ${format.textColor}">${formattedSegment}</span>`;
        }
        
        // Apply background color
        if (format.backgroundColor) {
          formattedSegment = `<span style="background-color: ${format.backgroundColor}">${formattedSegment}</span>`;
        }
        
        // Apply alignment
        if (format.alignment !== 'left') {
          formattedSegment = `<div style="text-align: ${format.alignment}">${formattedSegment}</div>`;
        }
        
        formattedText += formattedSegment;
        
        lastIndex = format.end;
      });
      
      // Add remaining text
      if (lastIndex < text.length) {
        formattedText += text.substring(lastIndex);
      }
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
              <div class="text">${formattedText}</div>
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
              <div class="text">${formattedText}</div>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Formatting toolbar - First line */}
      <View style={styles.toolbar}>
        {/* Text style buttons */}
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.bold && styles.activeButton]} 
          onPress={toggleBold}
        >
          <MaterialIcons name="format-bold" size={20} color={currentFormat.bold ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.italic && styles.activeButton]} 
          onPress={toggleItalic}
        >
          <MaterialIcons name="format-italic" size={20} color={currentFormat.italic ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.underline && styles.activeButton]} 
          onPress={toggleUnderline}
        >
          <MaterialIcons name="format-underline" size={20} color={currentFormat.underline ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <View style={styles.separator} />
        
        {/* Heading buttons */}
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.heading === 'h1' && styles.activeButton]} 
          onPress={() => setHeading('h1')}
        >
          <Text style={[styles.headingText, currentFormat.heading === 'h1' && styles.activeHeadingText]}>H1</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.heading === 'h2' && styles.activeButton]} 
          onPress={() => setHeading('h2')}
        >
          <Text style={[styles.headingText, currentFormat.heading === 'h2' && styles.activeHeadingText]}>H2</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.heading === 'none' && styles.activeButton]} 
          onPress={() => setHeading('none')}
        >
          <MaterialIcons name="text-fields" size={20} color={currentFormat.heading === 'none' ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <View style={styles.separator} />
        
        {/* PDF List Button */}
        <TouchableOpacity 
          style={styles.pdfButton} 
          onPress={goToPdfList}
        >
          <MaterialIcons name="folder" size={20} color="#fff" /> 
          <Text style={styles.pdfButtonText}>PDF List</Text>
        </TouchableOpacity>
      </View>

      {/* Formatting toolbar - Second line */}
      <View style={styles.toolbar}>
        {/* Font size controls */}
        <TouchableOpacity 
          style={styles.toolbarButton} 
          onPress={decreaseFontSize}
        >
          <MaterialIcons name="remove" size={20} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.fontSizeText}>{currentFormat.fontSize}</Text>
        
        <TouchableOpacity 
          style={styles.toolbarButton} 
          onPress={increaseFontSize}
        >
          <MaterialIcons name="add" size={20} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.separator} />
        
        {/* Alignment buttons */}
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.alignment === 'left' && styles.activeButton]} 
          onPress={() => setTextAlignment('left')}
        >
          <MaterialIcons name="format-align-left" size={20} color={currentFormat.alignment === 'left' ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.alignment === 'center' && styles.activeButton]} 
          onPress={() => setTextAlignment('center')}
        >
          <MaterialIcons name="format-align-center" size={20} color={currentFormat.alignment === 'center' ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.alignment === 'right' && styles.activeButton]} 
          onPress={() => setTextAlignment('right')}
        >
          <MaterialIcons name="format-align-right" size={20} color={currentFormat.alignment === 'right' ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <View style={styles.separator} />
        
        {/* Color buttons */}
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.textColor && styles.activeButton]} 
          onPress={toggleTextColor}
        >
          <MaterialIcons name="format-color-text" size={20} color={currentFormat.textColor ? '#4285F4' : '#333'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolbarButton, currentFormat.backgroundColor && styles.activeButton]} 
          onPress={toggleBackgroundColor}
        >
          <MaterialIcons name="format-color-fill" size={20} color={currentFormat.backgroundColor ? '#4285F4' : '#333'} />
        </TouchableOpacity>
      </View>

      {/* Editor area - Maximally simplified */}
      <KeyboardAvoidingView 
        style={styles.editorBox}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollViewContent}
        >
          {renderFormattedText()}
        </ScrollView>
        
        {/* Hidden WebView for justify functionality */}
        <WebView
          ref={webViewRef}
          style={{ width: 0, height: 0, opacity: 0 }}
          source={{ html: '<html><body></body></html>' }}
          onMessage={(event) => {
            console.log('WebView message:', event.nativeEvent.data);
          }}
        />
      </KeyboardAvoidingView>

      {/* Export buttons at the bottom - Updated to match ExtractedTextScreen */}
      <View style={styles.exportButtonsContainer}>
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: '#4285F4' }]}
          onPress={handleExportEnglish}
          disabled={isExportingEnglish || isExportingHindi || !text}
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
          disabled={isExportingEnglish || isExportingHindi || !text}
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

      {/* File Name Input Modal */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter File Name</Text>
            <TextInput
              style={styles.fileNameInput}
              value={fileNameInput}
              onChangeText={setFileNameInput}
              placeholder="Enter file name"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowExportModal(false)}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 90, // Increased width to accommodate text
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5
    // Remove fixed height and width to allow text to flow naturally
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  editorBox: {
    flex: 1,
    margin: 10,
    borderWidth: 2,
    borderColor: 'red',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    flexGrow: 1,
    width: '100%',
    minHeight: '100%',
  },
  textContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    minHeight: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    width: '100%',
    height: '100%',
    padding: 16,
  },
  formattedTextContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    minHeight: '100%',
  },
  formattedText: {
    fontSize: 16,
    lineHeight: 24,
    flexWrap: 'wrap',
    width: '100%',
    minHeight: '100%',
    textAlign: 'left', // Default alignment
    padding: 16,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  selectionHandle: {
    position: 'absolute',
    width: 10,
    height: 20,
    backgroundColor: '#4285F4',
    borderRadius: 5,
    top: 0,
  },
  startHandle: {
    left: 0,
  },
  endHandle: {
    left: 0,
  },
  selectionHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    top: 0,
  },
  justifyContainer: {
    width: '100%',
    marginVertical: 2,
  },
  justifyLine: {
    width: '100%',
    marginVertical: 1,
  },
  fontSizeText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  headingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  activeHeadingText: {
    color: '#4285F4',
  },
  toolbarButton: {
    padding: 8,
    marginHorizontal: 2,
    borderRadius: 4,
  },
  activeButton: {
    backgroundColor: '#e0e0e0',
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  exportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    padding: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
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
});

export default SimpleTextEditorScreen; 