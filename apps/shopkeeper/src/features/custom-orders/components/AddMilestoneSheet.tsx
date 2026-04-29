import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { MilestoneResponse } from '../types';

interface Props {
  orderId: string;
  visible: boolean;
  onClose: () => void;
}

export function AddMilestoneSheet({ orderId, visible, onClose }: Props): React.ReactElement {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation<MilestoneResponse>({
    mutationFn: async () => {
      const r = await api.post<MilestoneResponse>(
        `/api/v1/custom-orders/${orderId}/milestones`,
        { title: title.trim(), note: note.trim() || undefined },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['custom-order', orderId] });
      setTitle('');
      setNote('');
      onClose();
    },
    onError: () => {
      Alert.alert('त्रुटि', 'माइलस्टोन जोड़ा नहीं जा सका');
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>प्रगति जोड़ें</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>शीर्षक *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="जैसे: डिज़ाइन तैयार"
            maxLength={200}
            autoFocus
          />

          <Text style={styles.label}>नोट</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            placeholder="ग्राहक के लिए विवरण..."
            multiline
            numberOfLines={4}
            maxLength={2000}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, (!title.trim() || mutation.isPending) && styles.btnDisabled]}
            onPress={() => { if (title.trim()) mutation.mutate(); }}
            disabled={!title.trim() || mutation.isPending}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>जोड़ें</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#FDF6EC' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D4A85A' },
  title:          { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 18, color: '#5C3D11' },
  closeBtn:       { padding: 4 },
  closeText:      { fontSize: 18, color: '#7A5400' },
  body:           { padding: 20 },
  label:          { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 14, color: '#5C3D11', marginBottom: 6, marginTop: 16 },
  input:          { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4A85A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#3D2000', minHeight: 48 },
  multiline:      { minHeight: 100, textAlignVertical: 'top' },
  footer:         { padding: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#D4A85A' },
  btn:            { borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  btnPrimary:     { backgroundColor: '#B8860B' },
  btnDisabled:    { opacity: 0.5 },
  btnPrimaryText: { color: '#fff', fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 16 },
});
