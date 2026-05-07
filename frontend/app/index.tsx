// app/index.tsx - Redirect to tabs or login based on auth
import { Redirect } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';

export default function Index() {
  const { isAuthenticated, isBootstrapping } = useApp();
  if (isBootstrapping) return null;
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/login'} />;
}
