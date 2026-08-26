import * as Linking from 'expo-linking';
import { Share } from 'react-native';

export function getInviteUrl(roomId: string): string {
  return Linking.createURL('/', { queryParams: { room: roomId } });
}

export async function shareInvite(roomId: string): Promise<boolean> {
  await Share.share({ url: getInviteUrl(roomId) });
  return true;
}

