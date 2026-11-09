import React from 'react';
import LoginView, { LoginNote } from '../LoginView';

export default function LoginScreen() {
  return (
    <LoginView badge="E-paper studio" badgeIcon="grid" subtitle="Sign in with your editor or admin account to upload papers and build the e-paper."
      footer={<LoginNote>Use the same email and password as the JV Admin app. Signing in here signs you out of JV Admin and the web app, as an account can be signed in on one device at a time.</LoginNote>} />
  );
}
