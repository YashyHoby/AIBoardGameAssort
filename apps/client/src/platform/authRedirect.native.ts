import * as Linking from 'expo-linking';

export function getAuthRedirectUrl(): string {
  return Linking.createURL('/');
}

