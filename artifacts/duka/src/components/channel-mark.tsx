import React from 'react';
import { SiFacebook, SiInstagram, SiSnapchat, SiTiktok, SiWhatsapp, SiX } from 'react-icons/si';
import { MoreHorizontal, ShoppingBag, WalletCards } from 'lucide-react';

export type MarkKey =
  | 'whatsapp'
  | 'instagram'
  | 'tiktok'
  | 'snapchat'
  | 'facebook_ads'
  | 'paystack'
  | 'mobile_money'
  | 'x'
  | 'in_person'
  | 'other';

export const markCatalog = {
  whatsapp: { label: 'WhatsApp', Icon: SiWhatsapp, color: '#25D366', kind: 'brand' },
  instagram: { label: 'Instagram', Icon: SiInstagram, color: '#E4405F', kind: 'brand' },
  tiktok: { label: 'TikTok', Icon: SiTiktok, color: '#111111', kind: 'brand' },
  snapchat: { label: 'Snapchat', Icon: SiSnapchat, color: '#FFFC00', kind: 'brand' },
  facebook_ads: { label: 'Facebook Ads', Icon: SiFacebook, color: '#1877F2', kind: 'brand' },
  paystack: { label: 'Paystack', Icon: WalletCards, color: '#00C3F7', kind: 'provider' },
  mobile_money: { label: 'Mobile Money', Icon: WalletCards, color: '#111111', kind: 'category' },
  x: { label: 'X', Icon: SiX, color: '#111111', kind: 'brand' },
  in_person: { label: 'In person', Icon: ShoppingBag, color: '#111111', kind: 'category' },
  other: { label: 'Other', Icon: MoreHorizontal, color: '#111111', kind: 'category' },
} as const;

export const markKeyFor = (value: string): MarkKey => {
  const key = value.toLowerCase().replace(/[\s-]+/g, '_') as MarkKey;
  return key in markCatalog ? key : 'other';
};

export function ChannelMark({
  value,
  size = 17,
  className = '',
  colorful = true,
}: {
  value: string;
  size?: number;
  className?: string;
  colorful?: boolean;
}) {
  const mark = markCatalog[markKeyFor(value)];
  const Icon = mark.Icon;
  const color = colorful && (mark.kind === 'brand' || mark.kind === 'provider') ? mark.color : undefined;
  return <Icon size={size} aria-hidden="true" className={className} style={color ? { color } : undefined} />;
}
