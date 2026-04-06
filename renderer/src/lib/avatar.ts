const SAFE_AVATAR_PROTOCOL = /^(data:image\/|blob:|https?:\/\/)/i
const BLOCKED_AVATAR_PROTOCOL = /^file:\/\//i

export const getSafeAvatarSrc = (avatar?: string | null): string | undefined => {
  const value = avatar?.trim()

  if (!value || BLOCKED_AVATAR_PROTOCOL.test(value)) {
    return undefined
  }

  return SAFE_AVATAR_PROTOCOL.test(value) ? value : undefined
}