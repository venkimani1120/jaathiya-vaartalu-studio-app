import React from 'react';
import LoginView, { LoginNote } from '../LoginView';

export default function LoginScreen() {
  return (
    <LoginView badge="Editor / Admin desk" badgeIcon="shield-checkmark" subtitle="Sign in to review news and build the e-paper."
      footer={<LoginNote>New reporters sign up in the Reporter app. An admin can then make them an editor.</LoginNote>} />
  );
}
