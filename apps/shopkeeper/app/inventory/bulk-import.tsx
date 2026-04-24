import React, { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { api } from '../../src/api/client';

const CSV_TEMPLATE_HEADERS =
  'sku,category,metal,purity,gross_weight,net_weight,stone_weight,stone_details,making_charge_override,huid,image_urls';

type Step = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errorFileUrl?: string;
}

async function uploadFileToPresignedUrl(uri: string, uploadUrl: string): Promise<void> {
  const response = await fetch(uri);
  const blob = await response.blob();
  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'text/csv' },
  });
}

export default function BulkImportScreen(): React.ReactElement {
  const [step, setStep] = useState<Step>('idle');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const { data: jobStatus } = useQuery<JobStatus>({
    queryKey: ['bulk-import-status', jobId],
    queryFn: async () => {
      const res = await api.get<JobStatus>(`/api/v1/inventory/bulk-import/${jobId}`);
      return res.data;
    },
    enabled: step === 'polling' && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') return false;
      return 3000;
    },
  });

  React.useEffect(() => {
    if (!mountedRef.current) return;
    if (jobStatus?.status === 'completed' || jobStatus?.status === 'failed') {
      setStep('done');
    }
  }, [jobStatus?.status]);

  function downloadTemplate(): void {
    Alert.alert(
      t('inventory.bulk_import_btn_download_template'),
      `Columns:\n${CSV_TEMPLATE_HEADERS}`,
    );
  }

  async function pickFile(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setFile(result.assets[0]);
    }
  }

  const startImportMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('no_file');

      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { data: urlRes } = await api.post<{ uploadUrl: string; jobId: string }>(
        '/api/v1/inventory/bulk-import',
        { idempotencyKey },
      );

      if (mountedRef.current) setStep('uploading');
      await uploadFileToPresignedUrl(file.uri, urlRes.uploadUrl);

      const { data: triggerRes } = await api.post<{ jobId: string }>(
        `/api/v1/inventory/bulk-import/${urlRes.jobId}/trigger`,
      );
      return triggerRes;
    },
    onSuccess: (res) => {
      if (!mountedRef.current) return;
      setJobId(res.jobId);
      setStep('polling');
    },
    onError: () => {
      if (!mountedRef.current) return;
      setStep('error');
    },
  });

  function handleStart(): void {
    if (!file) {
      Alert.alert('', t('inventory.bulk_import_error_no_file'));
      return;
    }
    startImportMutation.mutate();
  }

  const isBusy = step === 'uploading' || step === 'polling';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle} accessibilityRole="header">
        {t('inventory.bulk_import_title')}
      </Text>

      <SettingsGroupCard title={t('inventory.bulk_import_step1_label')}>
        <View style={styles.cardRow}>
          <Pressable
            style={styles.outlineBtn}
            onPress={downloadTemplate}
            accessibilityRole="button"
            accessibilityLabel={t('inventory.bulk_import_btn_download_template')}
          >
            <Text style={styles.outlineBtnText}>
              {t('inventory.bulk_import_btn_download_template')}
            </Text>
          </Pressable>
        </View>
      </SettingsGroupCard>

      <SettingsGroupCard title={t('inventory.bulk_import_step2_label')}>
        <View style={styles.cardRow}>
          <Pressable
            style={styles.outlineBtn}
            onPress={pickFile}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={t('inventory.bulk_import_btn_pick_file')}
          >
            <Text style={styles.outlineBtnText}>
              {file ? file.name : t('inventory.bulk_import_btn_pick_file')}
            </Text>
          </Pressable>
        </View>
      </SettingsGroupCard>

      {(step === 'idle' || step === 'error') && (
        <Pressable
          style={[styles.primaryBtn, !file && styles.primaryBtnDisabled]}
          onPress={handleStart}
          disabled={!file || startImportMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('inventory.bulk_import_btn_start')}
        >
          {startImportMutation.isPending
            ? <ActivityIndicator color='#FFFFFF' />
            : <Text style={styles.primaryBtnText}>{t('inventory.bulk_import_btn_start')}</Text>
          }
        </Pressable>
      )}

      {(step === 'uploading' || (step === 'polling' && !jobStatus)) && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.progressText}>{t('inventory.bulk_import_step3_label')}</Text>
        </View>
      )}

      {step === 'polling' && jobStatus && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.progressText}>
            {t('inventory.bulk_import_step4_label', {
              processed: String(jobStatus.processed),
              succeeded: String(jobStatus.succeeded),
            })}
          </Text>
        </View>
      )}

      {step === 'done' && jobStatus && (
        <SettingsGroupCard title={t('inventory.bulk_import_step5_label')}>
          <View style={styles.cardRow}>
            <Text style={styles.summaryText}>
              {t('inventory.bulk_import_summary_success', { succeeded: String(jobStatus.succeeded) })}
            </Text>
            {jobStatus.failed > 0 && (
              <Text style={[styles.summaryText, styles.errorText]}>
                {t('inventory.bulk_import_summary_failed', { failed: String(jobStatus.failed) })}
              </Text>
            )}
            {jobStatus.errorFileUrl ? (
              <Pressable
                style={[styles.outlineBtn, styles.outlineBtnError]}
                onPress={() => Alert.alert(
                  t('inventory.bulk_import_btn_download_errors'),
                  jobStatus.errorFileUrl ?? '',
                )}
                accessibilityRole="button"
                accessibilityLabel={t('inventory.bulk_import_btn_download_errors')}
              >
                <Text style={[styles.outlineBtnText, styles.errorText]}>
                  {t('inventory.bulk_import_btn_download_errors')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </SettingsGroupCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: {
    color: colors.ink,
    marginBottom: spacing.lg,
    fontSize: 22,
    fontWeight: '600',
  },
  cardRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  outlineBtnError: { borderColor: colors.error },
  outlineBtnText: { color: colors.primary, fontSize: 16, fontWeight: '500' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  progressText: { color: colors.ink, fontSize: 16 },
  summaryText: { color: colors.ink, fontSize: 16, marginBottom: spacing.xs },
  errorText: { color: colors.error },
});
