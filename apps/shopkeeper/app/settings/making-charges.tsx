// TODO Story 1.4: wrap with SettingsGroupCard once available
import React, { useState } from 'react';
import { View } from 'react-native';
import { MakingChargeRow } from '../../src/features/settings/components/MakingChargeRow';

export default function MakingChargesScreen(): React.ReactElement {
  const [config, setConfig] = useState({
    category: 'RINGS' as const,
    type: 'percent' as const,
    value: '12.00',
  });

  return (
    <View>
      <MakingChargeRow config={config} onChange={setConfig} />
    </View>
  );
}
