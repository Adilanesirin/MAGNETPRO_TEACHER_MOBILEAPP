import ForceUpdateModal from '@/components/ForceUpdateModal';
import { theme } from '@/constants/theme';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const STORAGE_KEY = 'magnetpro_institution_id';

export default function LoginScreen() {
  const router = useRouter();
  const { updateAvailable, message, openStore } = useVersionCheck();
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [institutionId, setInstitutionId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberInstitution, setRememberInstitution] = useState(true);

  // Load saved institution ID on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) setInstitutionId(saved);
    });
  }, []);

  const onLogin = async () => {
    if (!institutionId.trim()) return Alert.alert('Missing', 'Please enter your Institution ID');
    if (!username.trim()) return Alert.alert('Missing', 'Please enter your username');
    if (!password) return Alert.alert('Missing', 'Please enter your password');

    setLoading(true);
    try {
      // Save institution ID if remember is checked
      if (rememberInstitution) {
        await AsyncStorage.setItem(STORAGE_KEY, institutionId.trim());
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }

      const res = await fetch('https://magnetpro.in/api/user-login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: institutionId.trim(),
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        await AsyncStorage.setItem('magnetpro_user', JSON.stringify(data));
        router.replace('/(tabs)');
      }
       else {
        const msg = data?.message || data?.detail || 'Invalid credentials';
        Alert.alert('Login Failed', String(msg));
      }
    } catch (err) {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/TeacherrLogin.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* Dark overlay for readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.65)']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <View style={styles.header}>
           <View style={styles.iconRing}>
            <Image
              source={require('../../assets/images/logo-only.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
            <Text style={styles.appName}>MagnetPRO</Text>
            <Text style={styles.tagline}>Teacher Portal</Text>
          </View>

          {/* Glass card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Enter your institution credentials below</Text>

            {/* Institution ID */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Institution ID</Text>
              <View style={styles.inputRow}>
                <MaterialIcons name="domain" size={18} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  value={institutionId}
                  onChangeText={setInstitutionId}
                  placeholder="e.g. GWxxxxxxxxxxU"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Remember toggle */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberInstitution(!rememberInstitution)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberInstitution && styles.checkboxActive]}>
                {rememberInstitution && <MaterialIcons name="check" size={12} color="#fff" />}
              </View>
              <Text style={styles.rememberText}>Remember Institution ID</Text>
            </TouchableOpacity>

            {/* Username */}
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputRow}>
                <MaterialIcons name="person" size={18} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Teacher"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <MaterialIcons name="lock" size={18} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={[styles.input, { flex: 1 }]}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={onLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>


            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <LinearGradient
                colors={[theme.colors.primaryLight, theme.colors.primary]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign In</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>© Powered by IMCBS · V{Constants.expoConfig?.version}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
       <ForceUpdateModal
        visible={updateAvailable && !dismissedUpdate}
        message={message}
        onUpdate={openStore}
        onLater={() => setDismissedUpdate(true)}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 32 },
 iconRing: {
    width: 70,
    height: 70,
    borderRadius: 40,
    backgroundColor: '#fefefeee',
    borderWidth: 3,
    borderColor: '#17b7c6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    //shadowColor: '#25b9e6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  logoImage: {
    width: 69,
    height: 69,
    borderRadius: 28,
  },
  appName: {
    color: '#62e1f8',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  tagline: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Glass card
  card: {
    backgroundColor: 'rgba(20,20,35,0.72)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginBottom: 24,
  },

  // Fields
  fieldGroup: {},
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: { padding: 4 },

  // Remember
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  rememberText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },

  // Forgot
  forgot: { alignSelf: 'flex-end', marginTop: 12, marginBottom: 4 },
  forgotText: { color: theme.colors.primaryLight ?? '#7EB3FF', fontSize: 13, fontWeight: '600' },

  // Button
  button: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Footer
  footer: {
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 28,
  },
});