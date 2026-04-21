import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AuditEventRow, Skeleton } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = 'today' | '7d' | '30d';
type Category = 'auth' | 'staff' | 'settings' | 'access';

interface AuditEventDto {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  createdAt: string; // ISO UTC
  metadata?: Record<string, unknown>;
}

interface AuditLogResponse {
  events: AuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'आज',
  '7d': '7 दिन',
  '30d': '30 दिन',
};

const CATEGORY_LABELS: Record<Category, string> = {
  auth: 'लॉगिन',
  staff: 'स्टाफ',
  settings: 'सेटिंग्स',
  access: 'पहुंच',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const PAGE_SIZE = 20;
const SKELETON_COUNT = 5;

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchAuditLog(params: {
  dateRange: DateRange;
  category: Category | undefined;
  page: number;
}): Promise<AuditLogResponse> {
  const qs: Record<string, string> = {
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
    dateRange: params.dateRange,
  };
  if (params.category !== undefined) {
    qs['category'] = params.category;
  }
  const queryString = new URLSearchParams(qs).toString();
  const res = await api.get<AuditLogResponse>(`/auth/audit-log?${queryString}`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SkeletonRows(): React.ReactElement {
  return (
    <View>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={180} height={16} />
          <View style={{ height: 4 }} />
          <Skeleton width={130} height={13} />
          <View style={{ height: 4 }} />
          <Skeleton width={90} height={12} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AuditLogScreen(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Role gate — show before any API call. The query is also disabled via `enabled` below.
  if (role === 'shop_staff') {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedText}>इस पेज तक पहुंच नहीं है</Text>
        <Text style={styles.deniedSub}>केवल मालिक और प्रबंधक देख सकते हैं।</Text>
      </View>
    );
  }

  const isAllowed = role === 'shop_admin' || role === 'shop_manager';

  const { data, isLoading, isError, refetch } = useQuery<AuditLogResponse, Error>({
    queryKey: ['audit-log', dateRange, category, page],
    queryFn: () => fetchAuditLog({ dateRange, category, page }),
    enabled: isAllowed,
  });

  const totalPages = data !== undefined ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const hasMore = page < totalPages;

  const handleEndReached = useCallback((): void => {
    if (hasMore && !isLoading) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isLoading]);

  const handleDateRange = (range: DateRange): void => {
    setDateRange(range);
    setPage(1);
  };

  const handleCategory = (cat: Category): void => {
    if (category === cat) {
      setCategory(undefined);
    } else {
      setCategory(cat);
    }
    setPage(1);
  };

  const renderItem = ({ item }: ListRenderItemInfo<AuditEventDto>): React.ReactElement => (
    <AuditEventRow
      key={item.id}
      action={item.action}
      actorName={item.actorName}
      actorRole={item.actorRole}
      createdAt={item.createdAt}
      metadata={item.metadata}
      testID={`audit-row-${item.id}`}
    />
  );

  const renderFooter = (): React.ReactElement | null => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} testID="audit-load-more" />
      </View>
    );
  };

  const renderEmpty = (): React.ReactElement => (
    <View style={styles.centered}>
      <Text style={styles.emptyText}>कोई गतिविधि नहीं</Text>
      <Text style={styles.emptySub}>चुने गए फ़िल्टर में कोई रिकॉर्ड नहीं मिला।</Text>
    </View>
  );

  const renderError = (): React.ReactElement => (
    <View style={styles.centered}>
      <Text style={styles.errorText}>लोड नहीं हो सका</Text>
      <Text style={styles.errorSub}>कृपया दोबारा कोशिश करें।</Text>
      <TouchableOpacity
        onPress={() => void refetch()}
        style={styles.retryButton}
        accessibilityRole="button"
      >
        <Text style={styles.retryButtonText}>फिर से लोड करें</Text>
      </TouchableOpacity>
    </View>
  );

  const events = data?.events ?? [];

  return (
    <View style={styles.container}>
      {/* Filter area */}
      <View style={styles.filtersContainer}>
        {/* Date range chips */}
        <View style={styles.chipRow}>
          {(['today', '7d', '30d'] as DateRange[]).map((range) => (
            <FilterChip
              key={range}
              label={DATE_RANGE_LABELS[range]}
              active={dateRange === range}
              onPress={() => handleDateRange(range)}
              testID={`filter-date-${range}`}
            />
          ))}
        </View>

        {/* Category chips */}
        <View style={[styles.chipRow, styles.chipRowSecondary]}>
          {ALL_CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              active={category === cat}
              onPress={() => handleCategory(cat)}
              testID={`filter-cat-${cat}`}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      {isLoading && page === 1 ? (
        <View style={styles.listCard}>
          <SkeletonRows />
        </View>
      ) : isError ? (
        renderError()
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={events.length === 0 ? styles.flatListEmpty : styles.flatListContent}
          style={styles.flatList}
          testID="audit-event-list"
          accessibilityLabel="गतिविधि लॉग सूची"
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Filters
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRowSecondary: {
    marginTop: 8,
  },
  chip: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#EDE3CC',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '500',
    color: colors.inkMute,
  },
  chipLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // FlatList
  flatList: {
    flex: 1,
  },
  flatListContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  flatListEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List card wrapper (skeleton)
  listCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Footer loader
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  // Skeleton row
  skeletonRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 56,
    justifyContent: 'center',
  },

  // Centered states
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Access denied
  deniedText: {
    fontFamily: typography.headingMid.family,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  deniedSub: {
    fontFamily: typography.body.family,
    fontSize: 15,
    color: colors.inkMute,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Empty state
  emptyText: {
    fontFamily: typography.headingMid.family,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.body.family,
    fontSize: 15,
    color: colors.inkMute,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Error state
  errorText: {
    fontFamily: typography.headingMid.family,
    fontSize: 18,
    fontWeight: '700',
    color: colors.error,
    textAlign: 'center',
  },
  errorSub: {
    fontFamily: typography.body.family,
    fontSize: 15,
    color: colors.inkMute,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
