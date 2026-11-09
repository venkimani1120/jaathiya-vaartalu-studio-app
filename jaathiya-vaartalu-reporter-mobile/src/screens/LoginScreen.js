import React from 'react';
import LoginView, { LoginLink } from '../LoginView';

export default function LoginScreen({ navigation }) {
  return (
    <LoginView badge="Reporter" badgeIcon="mic" subtitle="Sign in to file news from your constituency."
      footer={<LoginLink icon="person-add-outline" title="Create a reporter account" onPress={() => navigation.navigate('Signup')} />} />
  );
}
