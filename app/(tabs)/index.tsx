import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
 
export default function TabIndex() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = await AsyncStorage.getItem('token');
      const storedRole = await AsyncStorage.getItem('role');
      setToken(storedToken);
      setRole(storedRole);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!token || !role) {
    return <Redirect href="/login" />;
  }

  if (role === 'user') {
    return <Redirect href="/(tabs)/user" />;
  }
  if (role === 'agent') {
    return <Redirect href="/(tabs)/agent" />;
  }
  return <Redirect href="/login" />;
} 