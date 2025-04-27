import React, { useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Text, TouchableOpacity, Alert } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

const TestRichEditor: React.FC = () => {
  const [content, setContent] = useState('<p>Test content</p>');
  const richText = useRef<RichEditor>(null);

  const handleContentChange = (newContent: string) => {
    console.log('Content changed:', newContent);
    setContent(newContent);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Test Rich Editor</Text>
        
        <RichToolbar
          editor={richText}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.heading1,
            actions.heading2,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.alignLeft,
            actions.alignCenter,
            actions.alignRight,
          ]}
        />
        
        <View style={styles.editorContainer}>
          <RichEditor
            ref={richText}
            initialContentHTML={content}
            onChange={handleContentChange}
            placeholder="Start typing..."
            style={styles.editor}
            initialHeight={300}
          />
        </View>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => {
            console.log('Current content:', content);
            Alert.alert('Content', content);
          }}
        >
          <Text style={styles.buttonText}>Show Content</Text>
        </TouchableOpacity>
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
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  editorContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  editor: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TestRichEditor; 