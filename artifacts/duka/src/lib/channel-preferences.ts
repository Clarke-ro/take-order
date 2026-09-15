export const orderChannels = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'in_person', label: 'In person' },
] as const;

export const onboardingChannels = [
  'WhatsApp',
  'Instagram',
  'TikTok',
  'Snapchat',
  'In person',
  'Other',
] as const;

export function togglePreference(current: readonly string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export function connectPreferenceLabel(isSaved: boolean) {
  return isSaved ? 'Saved preference' : 'Not saved';
}

export function connectPreferenceAriaLabel(name: string, isSaved: boolean) {
  return `${name}, ${isSaved ? 'saved preference' : 'not saved'}. Select to ${isSaved ? 'remove' : 'save'} this preference.`;
}