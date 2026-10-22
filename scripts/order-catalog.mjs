import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const LETTER_PRICE = 49000;
export const ESTIMATED_SHIPPING = 30000;
const defaultGiftSets = [
  {
    id: 'flowers', name: 'Set Hoa dịu dàng', price: 99000,
    image: '/assets/gift-flowers.svg', images: [], description: 'Hoa sáp thơm · Đèn LED · Thiệp QR',
    components: [
      '01 bó hoa sáp thơm pastel, bền màu theo năm tháng',
      '01 dây đèn LED đom đóm ánh vàng ấm',
      '01 thiệp giấy mỹ thuật cao cấp in mã QR dẫn vào thư điện tử',
      '01 hộp quà cứng thắt nơ lụa, giúp bảo vệ quà khi giao hàng'
    ], variantLabel: 'Tông màu hoa', variants: ['Hồng Pastel', 'Kem Bơ', 'Đỏ Rượu']
  },
  {
    id: 'candle', name: 'Set Nến ấm áp', price: 129000,
    image: '/assets/gift-candle.svg', images: [], description: 'Nến thơm 100g · Hoa khô · Thiệp QR',
    components: [
      '01 hũ nến thơm tinh dầu thiên nhiên 100g, thời lượng đốt khoảng 20–25 giờ',
      '01 bó hoa khô trang trí nhỏ xinh',
      '01 hộp diêm thơm hoặc phụ kiện đi kèm',
      '01 thiệp giấy in mã QR và hộp quà lót giấy rơm'
    ], variantLabel: 'Mùi hương nến', variants: ['Đào Trắng', 'Lavender', 'Gỗ Thông']
  },
  {
    id: 'teddy', name: 'Set Gấu bông yêu thương', price: 159000,
    image: '/assets/gift-teddy.svg', images: [], description: 'Gấu bông 25cm · Hoa sáp · Thiệp QR',
    components: [
      '01 gấu bông lông mềm cao cấp, cao khoảng 25cm',
      '01 hoa sáp nhỏ đính kèm',
      '01 dây đèn LED trang trí',
      '01 thiệp giấy in mã QR và hộp quà có cửa sổ trong suốt'
    ], variantLabel: 'Màu nơ gấu', variants: ['Hồng Pastel', 'Kem Bơ', 'Đỏ Rượu']
  }
];
let giftSets = structuredClone(defaultGiftSets);
const catalogFile = () => resolve(process.env.GIFT_CATALOG_FILE || 'data/gift-catalog.json');
const validImageUrl = value => typeof value === 'string' && (/^\/assets\/[a-z0-9-]+\.svg$/.test(value) || /^\/media\/gifts\/[a-z0-9-]+\/[a-f0-9]{32}\.webp$/.test(value));
const validEntry = item => item && typeof item.id === 'string' && /^[a-z0-9-]{2,32}$/.test(item.id)
  && typeof item.name === 'string' && item.name.trim().length >= 2 && item.name.length <= 100
  && Number.isSafeInteger(item.price) && item.price >= 0 && item.price <= 100000000
  && typeof item.image === 'string' && validImageUrl(item.image)
  && Array.isArray(item.images) && item.images.length <= 5 && item.images.every(validImageUrl)
  && typeof item.description === 'string' && item.description.length <= 180
  && Array.isArray(item.components) && item.components.length <= 12 && item.components.every(part => typeof part === 'string' && part.length <= 220)
  && typeof item.variantLabel === 'string' && item.variantLabel.length <= 60
  && Array.isArray(item.variants) && item.variants.length >= 1 && item.variants.length <= 12 && item.variants.every(option => typeof option === 'string' && option.trim().length > 0 && option.length <= 60);

export async function loadGiftCatalog() {
  try {
    const parsed = JSON.parse(await readFile(catalogFile(), 'utf8'));
    if (Array.isArray(parsed) && parsed.length === defaultGiftSets.length && parsed.every(validEntry)
      && defaultGiftSets.every(defaultItem => parsed.some(item => item.id === defaultItem.id))) giftSets = parsed;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function getGiftSets() { return structuredClone(giftSets); }

export async function saveGiftSets(next) {
  if (!Array.isArray(next) || next.length !== defaultGiftSets.length || !next.every(validEntry)
    || defaultGiftSets.some(item => !next.some(candidate => candidate.id === item.id))) throw new Error('Thông tin set quà không hợp lệ.');
  giftSets = structuredClone(next);
  const file = catalogFile(); await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(giftSets, null, 2));
  return getGiftSets();
}

export function giftById(id) { return giftSets.find(item => item.id === id); }

export function quoteFor(packageType, giftSetId) {
  const gift = giftById(giftSetId);
  if (packageType === 'gift' && !gift && giftSetId !== 'custom') return null;
  return {
    letter: LETTER_PRICE,
    gift: gift?.price ?? null,
    shipping: packageType === 'gift' ? ESTIMATED_SHIPPING : 0,
    total: packageType === 'gift' && giftSetId === 'custom' ? null : LETTER_PRICE + (gift?.price || 0) + (packageType === 'gift' ? ESTIMATED_SHIPPING : 0),
    estimated: true
  };
}
