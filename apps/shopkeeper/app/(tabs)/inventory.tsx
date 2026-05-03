import React from 'react';
import { Redirect, type Href } from 'expo-router';

const inventoryHref = '/inventory' as Href;

export default function InventoryTabRedirect(): React.ReactElement {
  return <Redirect href={inventoryHref} />;
}
