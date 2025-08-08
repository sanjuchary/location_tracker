import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useRouter } from 'expo-router';

// For Android emulator use 10.0.2.2, for iOS simulator use localhost, for real device use your PC's IP
const API_URL = 'http://51.21.221.235/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'agent'>('user');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [redirect, setRedirect] = useState<string | null>(null);
  const router = useRouter();

  const handleAuth = async () => {
    setLoading(true);
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Auth failed');
      if (!isRegister) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('role', data.role);
        setRedirect(data.role === 'user' ? '/(tabs)/user' : '/(tabs)/agent');
      } else {
        Alert.alert('Registration successful', 'You can now log in.');
        setIsRegister(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (redirect) {
    return <Redirect href={redirect as any} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isRegister ? 'Register' : 'Login'}</Text>
      <View style={styles.switchContainer}>
        <TouchableOpacity
          onPress={() => setRole('user')}
          style={[styles.roleButton, role === 'user' && styles.activeRole]}
        >
          <Text
            style={role === 'user' ? styles.activeRoleText : styles.roleText}
          >
            User
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRole('agent')}
          style={[styles.roleButton, role === 'agent' && styles.activeRole]}
        >
          <Text
            style={role === 'agent' ? styles.activeRoleText : styles.roleText}
          >
            Agent
          </Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isRegister ? 'Register' : 'Login'}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
        <Text style={styles.link}>
          {isRegister
            ? 'Already have an account? Login'
            : "Don't have an account? Register"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#007AFF',
  },
  input: {
    width: 260,
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: 260,
    height: 44,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  link: { color: '#007AFF', marginTop: 8, fontSize: 15 },
  switchContainer: { flexDirection: 'row', marginBottom: 16 },
  roleButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeRole: { backgroundColor: '#007AFF' },
  roleText: { color: '#007AFF', fontWeight: 'bold' },
  activeRoleText: { color: '#fff', fontWeight: 'bold' },
});
