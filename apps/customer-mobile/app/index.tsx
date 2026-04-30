import { Redirect } from 'expo-router';

export default function Index(): JSX.Element {
  // Wired up in WS-C: redirect to /(auth)/welcome or /(tabs) based on session state.
  return <Redirect href="/(auth)/welcome" />;
}
