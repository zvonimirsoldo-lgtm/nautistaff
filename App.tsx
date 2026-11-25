import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { Btn, ToastProvider } from './src/components';
import { logout, registerForPush } from './src/push';
import { C } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import WorkerApp from './src/screens/worker/WorkerApp';
import EmployerApp from './src/screens/employer/EmployerApp';
import AdminApp from './src/screens/admin/AdminApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
            <StatusBar style="light" />
            <Header />
            <Root />
          </SafeAreaView>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Header() {
  const { profile } = useAuth();
  if (!profile) return null;
  const isWorker = profile.role === 'worker';
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0b1a33', borderBottomWidth: 1, borderBottomColor: C.border,
    }}>
      <Text style={{ color: C.text, fontWeight: '900', fontSize: 16 }}>⚓ NautiStaff <Text style={{ color: C.sky }}>Live</Text></Text>
      <Text style={{ color: isWorker ? C.sky : C.amberLight, fontSize: 11, fontWeight: '800' }}>
        {isWorker ? 'POSADA' : profile.role === 'admin' ? 'ADMIN' : 'POSLODAVAC'}
      </Text>
    </View>
  );
}

function Root() {
  const { session, profile, loading, profileError, reloadProfile } = useAuth();

  // PUSH: nakon prijave registriramo ovaj mobitel za obavijesti
  useEffect(() => {
    if (profile?.id) registerForPush();
  }, [profile?.id]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.sky} size="large" /></View>;
  }
  if (!session) return <AuthScreen />;

  if (!profile) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Profil se ne može učitati</Text>
        <Text style={{ color: C.muted, marginBottom: 16 }}>{profileError ?? 'Učitavanje…'}</Text>
        <Btn title="Pokušaj ponovno" onPress={reloadProfile} />
        <Btn title="Odjava" variant="ghost" onPress={logout} style={{ marginTop: 10 }} />
      </View>
    );
  }

  // key={userId} osigurava čisti početak kad se na istom mobitelu prijavi drugi korisnik
  if (profile.role === 'admin') return <AdminApp key={profile.id} />;
  if (profile.role === 'employer') return <EmployerApp key={profile.id} userId={profile.id} />;
  return <WorkerApp key={profile.id} userId={profile.id} />;
}
