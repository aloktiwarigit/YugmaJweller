// TODO Story 1.4: wrap with SettingsGroupCard once available
import React from 'react';
import { View } from 'react-native';
import { MakingChargeRow } from '../../src/features/settings/components/MakingChargeRow';
import type { MakingChargeConfig } from '@goldsmith/shared';
import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';

export default function MakingChargesScreen(): React.ReactElement {
  const [configs, setConfigs] = React.useState<MakingChargeConfig[]>(MAKING_CHARGE_DEFAULTS);

  function handleChange(updated: MakingChargeConfig): void {
    setConfigs((prev) => prev.map((c) => (c.category === updated.category ? updated : c)));
  }

  return (
    <View>
      {configs.map((c) => (
        <MakingChargeRow key={c.category} config={c} onChange={handleChange} />
      ))}
    </View>
  );
}
