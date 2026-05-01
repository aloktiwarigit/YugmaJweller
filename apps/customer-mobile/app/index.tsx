import { Redirect } from 'expo-router';
import { useCustomerSession } from '../src/hooks/useCustomerSession';

export default function Index(): JSX.Element {
  const { isAuthenticated } = useCustomerSession();
  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />;
}
