import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.text}>
          onemore! respects your privacy. We do not collect any personal data beyond what is necessary for the app to function.
        </Text>
        <Text style={styles.text}>
          The app uses anonymous authentication to provide a stable user identifier. Session data (participant names, drink events, and drink types) are stored in Supabase and are only accessible to users who have the session invite code.
        </Text>
        <Text style={styles.text}>
          No data is shared with third parties. All session data can be deleted by the session owner at any time.
        </Text>
        <Text style={styles.text}>
          If you have questions about privacy, please contact us.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 16,
  },
});
