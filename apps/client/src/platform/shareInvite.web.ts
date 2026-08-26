export function getInviteUrl(roomId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  return url.toString();
}

export async function shareInvite(roomId: string): Promise<boolean> {
  const inviteUrl = getInviteUrl(roomId);
  if (!navigator.clipboard) {
    return false;
  }
  await navigator.clipboard.writeText(inviteUrl);
  return true;
}

