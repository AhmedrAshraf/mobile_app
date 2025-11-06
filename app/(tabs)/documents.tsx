import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image, Linking, Alert, Modal, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

type Document = {
  id: string;
  type: string;
  uri: string;
  timestamp: number;
};

const DOCUMENT_TYPES = [
  "Driver's License",
  "Passport",
  "Green Card",
  "Immigration Documents",
  "Court Documents",
  "Birth Certificate",
  "Social Security Card",
  "Other ID"
];

export default function DocumentsScreen() {
  const { colors, shadows } = useTheme();
  const styles = getStyles(colors, shadows);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const savedDocs = await AsyncStorage.getItem('userDocuments');
      if (savedDocs) {
        setDocuments(JSON.parse(savedDocs));
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const pickDocument = async () => {
    if (!selectedType) {
      alert('Please select a document type first');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.images,
        quality: 1,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        const newDocument: Document = {
          id: Date.now().toString(),
          type: selectedType,
          uri: result.assets[0].uri,
          timestamp: Date.now(),
        };

        const updatedDocuments = [...documents, newDocument];
        setDocuments(updatedDocuments);
        await AsyncStorage.setItem('userDocuments', JSON.stringify(updatedDocuments));
        setSelectedType('');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      alert('Failed to upload document. Please try again.');
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const updatedDocuments = documents.filter(doc => doc.id !== id);
      setDocuments(updatedDocuments);
      await AsyncStorage.setItem('userDocuments', JSON.stringify(updatedDocuments));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  const viewDocument = async (uri: string) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'Document not found');
        return;
      }

      const fileExtension = uri.split('.').pop()?.toLowerCase();
      
      if (['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        setSelectedImage(uri);
        return;
      }

      if (fileExtension === 'pdf') {
        const tempFile = `${FileSystem.cacheDirectory}temp.pdf`;
        await FileSystem.copyAsync({
          from: uri,
          to: tempFile
        });
        await Linking.openURL(tempFile);
        return;
      }

      Alert.alert('Error', 'Unsupported file type');
    } catch (error) {
      console.error('Error viewing document:', error);
      Alert.alert('Error', 'Could not open the document. Please try again.');
    }
  };

  const downloadDocument = async (uri: string, type: string) => {
    try {
      // Check if the file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'Document not found');
        return;
      }

      const fileExtension = uri.split('.').pop()?.toLowerCase();

      const fileName = `${type}-${Date.now()}.${fileExtension}`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: uri,
        to: fileUri
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: fileExtension === 'pdf' ? 'application/pdf' : 
                  ['jpg', 'jpeg'].includes(fileExtension || '') ? 'image/jpeg' :
                  fileExtension === 'png' ? 'image/png' : 'application/octet-stream',
        dialogTitle: `Download ${type}`,
        UTI: fileExtension === 'pdf' ? 'com.adobe.pdf' : 'public.image'
      });

      Alert.alert('Success', 'Document downloaded successfully');
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert('Error', 'Could not download the document. Please try again.');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents</Text>
      
      <View style={styles.securityNote}>
        <MaterialIcons name="lock" size={20} color={colors.accent} />
        <Text style={styles.securityText}>
          Your documents are stored securely on your device
        </Text>
      </View>

      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Upload New Document</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.typeScroll}
          contentContainerStyle={styles.typeContainer}>
          {DOCUMENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                selectedType === type && styles.selectedTypeButton,
              ]}
              onPress={() => setSelectedType(type)}>
              <MaterialIcons 
                name="insert-drive-file" 
                size={16} 
                color={selectedType === type ? colors.text.primary : colors.text.muted} 
              />
              <Text
                style={[
                  styles.typeButtonText,
                  selectedType === type && styles.selectedTypeButtonText,
                ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={pickDocument}>
          <MaterialIcons name="upload" size={24} color={colors.text.primary} />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your Documents</Text>
      <ScrollView style={styles.documentList} contentContainerStyle={styles.documentListContent}>
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="shield" size={48} color={colors.text.muted} />
            <Text style={styles.emptyStateText}>
              No documents uploaded yet
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Add your important documents to keep them secure and accessible
            </Text>
          </View>
        ) : (
          documents.map((doc) => (
            <View key={doc.id} style={styles.documentCard}>
              <Image
                source={{ uri: doc.uri }}
                style={styles.documentThumbnail}
              />
              <View style={styles.documentInfo}>
                <Text style={styles.documentType}>{doc.type}</Text>
                <Text style={styles.documentDate}>
                  Added {formatDate(doc.timestamp)}
                </Text>
              </View>
              <View style={styles.documentActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => viewDocument(doc.uri)}>
                  <MaterialIcons name="visibility" size={20} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => downloadDocument(doc.uri, doc.type)}>
                  <MaterialIcons name="file-download" size={20} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteDocument(doc.id)}>
                  <MaterialIcons name="delete" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        
        {/* Add spacer at the bottom to account for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={!!selectedImage}
        transparent={true}
        onRequestClose={() => setSelectedImage(null)}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: selectedImage || '' }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
    fontFamily: 'Inter-Bold',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    padding: 15,
    borderRadius: radius.lg,
    marginBottom: 20,
    gap: 10,
    ...shadows.sm,
  },
  securityText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  uploadSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: colors.text.muted,
    fontSize: 14,
    textTransform: 'uppercase',
    marginBottom: 15,
    fontFamily: 'Inter-Medium',
  },
  typeScroll: {
    marginBottom: 20,
  },
  typeContainer: {
    gap: 10,
    paddingRight: 20,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radius.round,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.text.muted,
    ...shadows.sm,
  },
  selectedTypeButton: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeButtonText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  selectedTypeButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  uploadButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: radius.lg,
    gap: 10,
    ...shadows.sm,
  },
  uploadButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  documentList: {
    flex: 1,
  },
  documentListContent: {
    paddingBottom: 20, // Extra padding at the bottom
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 15,
    marginBottom: 15,
    ...shadows.sm,
  },
  documentThumbnail: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.text.muted,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 15,
  },
  documentType: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  documentDate: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: colors.text.muted,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateSubtext: {
    color: colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    fontFamily: 'Inter-Regular',
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: Dimensions.get('window').width * 0.9,
    height: Dimensions.get('window').height * 0.7,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
  },
  modalCloseText: {
    color: 'white',
    fontSize: 16,
  },
});