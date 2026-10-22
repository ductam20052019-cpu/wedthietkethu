export const LETTER_PRICE = 49000;
export const ESTIMATED_SHIPPING = 30000;
export const GIFT_SETS = Object.freeze([
  { id: 'flowers', name: 'Set Hoa dịu dàng', price: 99000, image: '/assets/gift-flowers.svg' },
  { id: 'candle', name: 'Set Nến ấm áp', price: 129000, image: '/assets/gift-candle.svg' },
  { id: 'teddy', name: 'Set Gấu bông yêu thương', price: 159000, image: '/assets/gift-teddy.svg' }
]);

export function quoteFor(packageType, giftSetId) {
  const gift = GIFT_SETS.find(item => item.id === giftSetId);
  if (packageType === 'gift' && !gift && giftSetId !== 'custom') return null;
  return {
    letter: LETTER_PRICE,
    gift: gift?.price ?? null,
    shipping: packageType === 'gift' ? ESTIMATED_SHIPPING : 0,
    total: packageType === 'gift' && giftSetId === 'custom' ? null : LETTER_PRICE + (gift?.price || 0) + (packageType === 'gift' ? ESTIMATED_SHIPPING : 0),
    estimated: true
  };
}
