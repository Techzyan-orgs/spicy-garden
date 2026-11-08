import { ExtendedMenuItem } from '@/hooks/useMenuData';
import { CartItem } from '@/context/CartContext';

export interface UpsellRecommendation {
  recommendedItem: ExtendedMenuItem;
  anchorItemName: string;
  headline: string;
  pitch: string;
  sensoryDescription: string;
  socialProof: string;
  comboTag: string;
  tag: string;
}

/**
 * Resolves a high-quality dish image, falling back gracefully to category hero images
 */
export function getDishImage(item?: { image?: string; image_url?: string; category?: string; category_id?: string } | null): string {
  if (!item) return '/unnamed (2).webp';
  if (item.image && item.image.trim()) return item.image;
  if (item.image_url && item.image_url.trim()) return item.image_url;
  const cat = (item.category || item.category_id || '').toLowerCase();
  if (cat === 'pizza') return '/unnamed (2).webp';
  if (cat === 'pasta') return '/pasta.webp';
  if (cat === 'burger') return '/unnamed (3).webp';
  if (cat === 'maggi') return '/maggi.webp';
  if (cat === 'sandwich') return '/sandwich.webp';
  if (cat === 'starters' || cat === 'chinese_specials') return '/unnamed (5).webp';
  if (cat === 'momos') return '/unnamed (6).webp';
  if (cat === 'main_course' || cat === 'rice' || cat === 'noodles') return '/unnamed (4).webp';
  if (cat === 'shakes_lassi') return '/coffee.jpg';
  if (cat === 'beverages') return '/beverage.jpg';
  if (cat === 'tea_coffee') return '/coffee.jpg';
  if (cat === 'soups_salads') return '/maggi.webp';
  return '/unnamed (2).webp';
}

export const DRINK_CATEGORIES = new Set(['tea_coffee', 'beverages', 'shakes_lassi']);

export function isDrinkCategory(category?: string): boolean {
  if (!category) return false;
  return DRINK_CATEGORIES.has(category.toLowerCase().trim());
}

// Map anchor dish categories/IDs to complementary recommendation candidate IDs in order of priority
interface PairingRule {
  anchorCategory?: string; // e.g. 'pizza', 'burger', 'pasta', 'chinese_specials', 'maggi'
  anchorItemIds?: string[]; // Specific dishes if granular
  tag: string;
  socialProofVeg: string;
  socialProofNonVeg: string;
  headlineVeg: string;
  headlineNonVeg: string;
  pitchVeg: string;
  pitchNonVeg: string;
  sensoryVeg: string;
  sensoryNonVeg: string;
  comboTagVeg: string;
  comboTagNonVeg: string;
  candidateIdsVeg: string[];
  candidateIdsNonVeg: string[];
}

export const PAIRING_RULES: PairingRule[] = [
  // 1. Laccha Paratha Specific Anchor (Must precede general 'noodles' category)
  {
    anchorItemIds: ['item-pr-1'],
    tag: "Chef's Gravy Match",
    socialProofNonVeg: '🔥 97% PAIR PARATHA WITH CHILLI CHICKEN',
    socialProofVeg: '⭐ 94% PAIR WITH PANEER CHILLI',
    headlineNonVeg: 'Scoop Up Rich Chilli Chicken Gravy!',
    headlineVeg: 'The Perfect Gravy For Flaky Paratha!',
    pitchNonVeg: 'Add Sizzling Chilli Chicken Gravy',
    pitchVeg: 'Add Rich Paneer Chilli Gravy',
    sensoryNonVeg: 'Tender boneless chicken morsels in a thick, glossy garlic-soya sauce made for wrapping inside warm, butter-toasted paratha folds.',
    sensoryVeg: 'Golden paneer cubes smothered in rich Indo-Chinese spiced gravy, waiting to be scooped with buttery layered paratha.',
    comboTagNonVeg: 'Laccha Paratha + Chilli Chicken = Perfect Bite',
    comboTagVeg: 'Laccha Paratha + Paneer Chilli = Desi Chinese Hit',
    candidateIdsVeg: ['item-mc-1-paneer', 'item-mc-2-paneer', 'item-mc-1-mushroom'],
    candidateIdsNonVeg: ['item-mc-1-chicken', 'item-mc-2-chicken', 'item-mc-3-chicken'],
  },

  // 2. Club Sandwiches Specific Anchor
  {
    anchorItemIds: ['san-14', 'san-15', 'san-16', 'san-17', 'san-18', 'san-19'],
    tag: 'Grand Club Feast',
    socialProofNonVeg: '🔥 92% PAIR WITH CHILLED REFRESHMENT',
    socialProofVeg: '⭐ 93% COMPLETE WITH A SIGNATURE SIP',
    headlineNonVeg: 'Turn It Into A Grand Club Feast!',
    headlineVeg: 'The Ultimate Triple-Decker Companion!',
    pitchNonVeg: 'Add Ice Cream Cold Coffee or Popcorn',
    pitchVeg: 'Add Sparkling Virgin Mojito or Cold Coffee',
    sensoryNonVeg: 'Triple-decker toasted club feast accompanied by frosty ice cream cold coffee and crunchy bites.',
    sensoryVeg: 'Zesty sparkling lime and garden mint bubbles that complement every layer of your triple-decker grill.',
    comboTagNonVeg: 'Triple Club + Cold Coffee = Grand Feast',
    comboTagVeg: 'Club Sandwich + Mint Mojito = Pure Joy',
    candidateIdsVeg: ['item-bv-6', 'item-tc-5', 'item-bv-3', 'item-vs-1'],
    candidateIdsNonVeg: ['item-bv-6', 'item-cs-1', 'item-tc-5', 'item-bv-3'],
  },

  // 3. Pizzas (Veg & Non-Veg)
  {
    anchorCategory: 'pizza',
    tag: 'Bistro Star Pairing',
    socialProofNonVeg: '🔥 89% OF PIZZA LOVERS PAIR THIS',
    socialProofVeg: '⭐ 91% OF GUESTS ADD A CHILLED SIP',
    headlineNonVeg: 'The Perfect Pizza Pre-Game Crunch!',
    headlineVeg: 'Cool Down That Molten Cheese!',
    pitchNonVeg: 'Add Golden Chicken Popcorn or Virgin Mojito',
    pitchVeg: 'Add Sparkling Virgin Mojito or Golden Fries',
    sensoryNonVeg: 'Bite into crunchy, seasoned chicken popcorn fresh out of the fryer while your artisan pizza bakes to bubbly perfection.',
    sensoryVeg: 'Zesty muddled garden mint, fresh lime, and ice-cold bubbles that slice right through rich, hot mozzarella cheese.',
    comboTagNonVeg: 'Cheesy Pizza + Crispy Popcorn = Ultimate Duo',
    comboTagVeg: 'Cheesy Pizza + Chilled Mojito = Pure Bliss',
    candidateIdsVeg: ['item-bv-6', 'item-vs-1', 'item-tc-5', 'item-bv-3'],
    candidateIdsNonVeg: ['item-cs-1', 'item-bv-6', 'item-cs-2', 'item-tc-5'],
  },

  // 4. Pastas (Veg & Non-Veg)
  {
    anchorCategory: 'pasta',
    tag: 'Italian Bistro Match',
    socialProofNonVeg: '🔥 86% PASTA LOVERS ADD THIS CRUNCH',
    socialProofVeg: '⭐ 88% CHOOSE A REFRESHING COOLER',
    headlineNonVeg: 'Saucy Penne Deserves Crispy Protein!',
    headlineVeg: 'The Ideal Crisp & Refreshing Companion!',
    pitchNonVeg: 'Add Golden Crumbed Chicken Fingers',
    pitchVeg: 'Add Chilled Virgin Mojito Cooler',
    sensoryNonVeg: 'Juicy, panko-breaded tender chicken fingers hot off the fryer — dip them straight into your creamy Alfredo or zesty Arrabbiata!',
    sensoryVeg: 'Frosty sparkling soda infused with muddled mint leaves and lime juice to cleanse your palate between velvety, herb-infused bites.',
    comboTagNonVeg: 'Velvety Pasta + Crispy Fingers = Chef Match',
    comboTagVeg: 'Saucy Pasta + Icy Mojito = Refreshing Harmony',
    candidateIdsVeg: ['item-bv-6', 'item-vs-1', 'item-bv-8', 'item-tc-5'],
    candidateIdsNonVeg: ['item-cs-2', 'item-cs-1', 'item-bv-6', 'item-tc-5'],
  },

  // 5. Burgers (Veg & Non-Veg)
  {
    anchorCategory: 'burger',
    tag: 'Bistro Monster Combo',
    socialProofNonVeg: '🔥 93% BURGER LOVERS UPGRADE TO THIS',
    socialProofVeg: '⭐ 94% COMPLETE THEIR BURGER MEAL',
    headlineNonVeg: 'Turn Your Burger Into The Ultimate Feast!',
    headlineVeg: 'No Burger Is Complete Without Fries!',
    pitchNonVeg: 'Add Hot Chicken Popcorn or French Fries',
    pitchVeg: 'Add Golden Salted French Fries',
    sensoryNonVeg: 'Tender, bite-sized chicken pops fried crisp and tossed in house seasonings — the most addictive crunch with every burger bite.',
    sensoryVeg: 'Hot, freshly tossed golden potato fries sprinkled with fine sea salt, served with zesty tomato concassé dip.',
    comboTagNonVeg: 'Loaded Burger + Chicken Popcorn = Bestseller Duo',
    comboTagVeg: 'Stacked Burger + Golden Fries = Classic Perfection',
    candidateIdsVeg: ['item-vs-1', 'item-bv-6', 'item-ms-10', 'item-tc-5'],
    candidateIdsNonVeg: ['item-cs-1', 'item-vs-1', 'item-tc-5', 'item-bv-6'],
  },

  // 6. Maggi Bowls (Veg & Non-Veg)
  {
    anchorCategory: 'maggi',
    tag: 'College Adda Classic',
    socialProofNonVeg: '🔥 91% ADDA GUESTS ORDER THIS COMBO',
    socialProofVeg: '⭐ 92% STUDENTS PAIR WITH COLD COFFEE',
    headlineNonVeg: 'The Unbeatable Kolkata Adda Pairing!',
    headlineVeg: 'Hot Spicy Maggi Meets Frosty Cold Coffee!',
    pitchNonVeg: 'Add Cold Coffee with Ice Cream or Chicken Momos',
    pitchVeg: 'Add Thick Cold Coffee with Ice Cream',
    sensoryNonVeg: 'Decadent espresso-whipped cold coffee crowned with a velvety scoop of vanilla ice cream — pure magic against steaming spicy Maggi noodles.',
    sensoryVeg: 'Rich, thick espresso blended with chilled creamy milk and topped with rich vanilla ice cream to balance every spicy, buttery noodle bite.',
    comboTagNonVeg: 'Spicy Maggi + Cold Coffee = Legendary Adda',
    comboTagVeg: 'Hot Cheesy Maggi + Ice Cream Cold Coffee',
    candidateIdsVeg: ['item-tc-5', 'item-tc-4', 'item-mm-1-steam', 'item-bv-6'],
    candidateIdsNonVeg: ['item-tc-5', 'item-mm-3-steam', 'item-cs-1', 'item-tc-4'],
  },

  // 7. Regular Sandwiches (Veg & Non-Veg)
  {
    anchorCategory: 'sandwich',
    tag: 'Cafe Adda Special',
    socialProofNonVeg: '🔥 88% FOODIES COMPLETE THIS ORDER',
    socialProofVeg: '⭐ 90% PAIR WITH A SIGNATURE SIP',
    headlineNonVeg: 'Elevate Your Sandwich Break!',
    headlineVeg: 'The Golden Cafe Adda Sip!',
    pitchNonVeg: 'Add Ice Cream Cold Coffee or Popcorn',
    pitchVeg: 'Add Cold Coffee with Ice Cream or Mojito',
    sensoryNonVeg: 'Frothy, full-bodied cold coffee with rich vanilla ice cream, turning a quick sandwich break into a lavish cafe feast.',
    sensoryVeg: 'Golden butter-toasted sandwich edges paired with a thick, velvety glass of ice cream cold coffee. Kolkata cafe culture at its finest!',
    comboTagNonVeg: 'Toasted Sandwich + Thick Cold Coffee',
    comboTagVeg: 'Crisp Grilled Sandwich + Ice Cream Cold Coffee',
    candidateIdsVeg: ['item-tc-5', 'item-bv-6', 'item-vs-1', 'item-ms-10'],
    candidateIdsNonVeg: ['item-tc-5', 'item-cs-1', 'item-bv-6', 'item-ms-10'],
  },

  // 8. Chinese Starters & Appetizers
  {
    anchorCategory: 'starters',
    tag: 'Chinatown Wok Duo',
    socialProofNonVeg: '🔥 94% TURN THIS INTO A COMPLETE MEAL',
    socialProofVeg: '⭐ 91% PAIR WITH WOK HAKKA NOODLES',
    headlineNonVeg: 'Pair With Kolkata Chinatown Wok Noodles!',
    headlineVeg: 'Complete Your Sizzling Chinese Spread!',
    pitchNonVeg: 'Add Wok Chicken Hakka Noodles or Fried Rice',
    pitchVeg: 'Add Tossed Veg Hakka Noodles or Fried Rice',
    sensoryNonVeg: 'Smoky, high-flame wok noodles tossed with tender chicken shreds and crunchy spring onions — the legendary companion to your sizzling starter.',
    sensoryVeg: 'Al dente noodles wok-tossed on high flame with julienned cabbage, capsicum, and Chinatown light soya. Sizzling starter perfection!',
    comboTagNonVeg: 'Crispy Starter + Chinatown Hakka Noodles = Pure Tangra',
    comboTagVeg: 'Chilli Starter + Veg Hakka Noodles = Street Legend',
    candidateIdsVeg: ['item-nd-1-veg', 'item-rc-1-veg', 'item-bv-6', 'item-bv-3'],
    candidateIdsNonVeg: ['item-nd-1-chicken', 'item-rc-1-chicken', 'item-nd-1-egg', 'item-bv-6'],
  },

  // 9. Tibetan Momos (Steamed, Fried, Kurkure)
  {
    anchorCategory: 'momos',
    tag: 'Himalayan Broth Match',
    socialProofNonVeg: '🔥 93% MOMO LOVERS ADD MANCHOW SOUP',
    socialProofVeg: '⭐ 89% GUESTS PAIR WITH HOT BROTH',
    headlineNonVeg: 'The Ultimate Steaming Momo & Broth Ritual!',
    headlineVeg: 'Warm Broth & Steaming Dumplings!',
    pitchNonVeg: 'Add Piping Hot Chicken Manchow Soup',
    pitchVeg: 'Add Steaming Veg Manchow Soup or Virgin Mojito',
    sensoryNonVeg: 'A piping hot bowl of thick chicken broth loaded with burnt garlic, fresh coriander, and crunchy fried noodles alongside your juicy momos.',
    sensoryVeg: 'Spicy, fragrant Indo-Chinese broth topped with golden fried noodles, perfectly complementing soft, steamed vegetable dumplings.',
    comboTagNonVeg: 'Juicy Momos + Hot Manchow Soup = Winter Bliss',
    comboTagVeg: 'Steamed Momos + Spiced Manchow Broth',
    candidateIdsVeg: ['item-sp-4-veg', 'item-bv-6', 'item-sp-3-veg', 'item-bv-3'],
    candidateIdsNonVeg: ['item-sp-4-chicken', 'item-bv-6', 'item-sp-3-chicken', 'item-bv-3'],
  },

  // 10. Soups & Salads
  {
    anchorCategory: 'soups_salads',
    tag: 'Soup & Starter Pack',
    socialProofNonVeg: '🔥 90% GUESTS START THEIR MEAL WITH THIS',
    socialProofVeg: '⭐ 88% PAIR WITH FRESH STEAMED MOMOS',
    headlineNonVeg: 'Start Your Feast The Authentic Way!',
    headlineVeg: 'The Cozy Starter Pairing!',
    pitchNonVeg: 'Add Juicy Steamed Chicken Momos or Popcorn',
    pitchVeg: 'Add Steamed Himalayan Veg Momos',
    sensoryNonVeg: 'Delicate, hand-pinched dumplings bursting with spiced minced chicken, served with fiery red chutney right beside your warming soup bowl.',
    sensoryVeg: 'Thin-wrapper Himalayan dumplings packed with finely minced farm veggies, served steaming hot alongside your aromatic broth.',
    comboTagNonVeg: 'Hot Broth + Chicken Momos = Opening Star',
    comboTagVeg: 'Warm Soup + Steamed Momos = Cozy Comfort',
    candidateIdsVeg: ['item-mm-1-steam', 'item-vs-5', 'item-vs-1', 'item-bv-6'],
    candidateIdsNonVeg: ['item-mm-3-steam', 'item-cs-1', 'item-cs-4', 'item-bv-6'],
  },

  // 11. Chinese Main Course Gravies (Chilli Chicken, Manchurian, Paneer, Mushroom)
  {
    anchorCategory: 'main_course',
    tag: 'Kolkata Royal Combination',
    socialProofNonVeg: '🔥 96% ORDER WITH LACCHA PARATHA OR FRIED RICE',
    socialProofVeg: '⭐ 95% PAIR WITH FRESH FLAKY PARATHA',
    headlineNonVeg: "Don't Leave A Single Drop Of Gravy Behind!",
    headlineVeg: 'The Golden Flaky Paratha Scoop!',
    pitchNonVeg: 'Add Fresh Laccha Paratha or Chicken Fried Rice',
    pitchVeg: 'Add Golden Laccha Paratha or Veg Fried Rice',
    sensoryNonVeg: 'Piping hot, flaky layered butter paratha fresh off the tawa, perfect for scooping up every last drop of rich, glossy chilli soya gravy.',
    sensoryVeg: 'Golden, multi-layered flatbread crisped with butter, ready to soak in every spoonful of savory, garlic-kissed Manchurian gravy.',
    comboTagNonVeg: 'Sizzling Chilli Gravy + Flaky Laccha Paratha = Heritage Hit',
    comboTagVeg: 'Rich Paneer Gravy + Layered Paratha = Pure Satisfaction',
    candidateIdsVeg: ['item-pr-1', 'item-rc-1-veg', 'item-nd-1-veg'],
    candidateIdsNonVeg: ['item-pr-1', 'item-rc-1-chicken', 'item-nd-1-chicken', 'item-rc-1-egg'],
  },

  // 12. Wok Fried Rice
  {
    anchorCategory: 'rice',
    tag: 'Chinatown Star Pair',
    socialProofNonVeg: '🔥 95% OF KOLKATA FOODIES PAIR WITH CHILLI CHICKEN',
    socialProofVeg: '⭐ 92% PAIR WITH SIZZLING PANEER CHILLI',
    headlineNonVeg: 'The Iconic Kolkata Chinese Match!',
    headlineVeg: 'The Golden Chinatown Feast!',
    pitchNonVeg: 'Add Sizzling Chilli Chicken or Drums of Heaven',
    pitchVeg: 'Add Rich Paneer Chilli Gravy or Baby Corn',
    sensoryNonVeg: 'Wok-charred chicken tossed with green chillies, diced capsicum, and dark soya glaze — the soulmate to your aromatic fried rice.',
    sensoryVeg: 'Succulent cottage cheese cubes simmered in a dark, aromatic soya-garlic reduction with crunchy bell peppers and spring onions.',
    comboTagNonVeg: 'Fried Rice + Chilli Chicken = Tangra Legend',
    comboTagVeg: 'Fried Rice + Paneer Chilli = Chinatown Classic',
    candidateIdsVeg: ['item-mc-1-paneer', 'item-vs-5', 'item-mc-2-paneer', 'item-bv-6'],
    candidateIdsNonVeg: ['item-mc-1-chicken', 'item-cs-4', 'item-mc-2-chicken', 'item-bv-6'],
  },

  // 13. Wok Noodles
  {
    anchorCategory: 'noodles',
    tag: 'Chinatown Star Pair',
    socialProofNonVeg: '🔥 95% OF KOLKATA FOODIES PAIR WITH CHILLI CHICKEN',
    socialProofVeg: '⭐ 92% PAIR WITH SIZZLING PANEER CHILLI',
    headlineNonVeg: 'The Authentic Chinatown Hakka Duo!',
    headlineVeg: 'Pair With Golden Street Starters!',
    pitchNonVeg: 'Add Sizzling Chilli Chicken or Drums of Heaven',
    pitchVeg: 'Add Rich Paneer Chilli Gravy or Crispy Corn',
    sensoryNonVeg: 'Wok-charred chicken tossed with green chillies, diced capsicum, and dark soya glaze alongside your steaming Hakka noodles.',
    sensoryVeg: 'Golden baby corn or cottage cheese cubes tossed in chef secret Chinatown reduction — noodles best friend.',
    comboTagNonVeg: 'Hakka Noodles + Chilli Chicken = Pure Tangra',
    comboTagVeg: 'Hakka Noodles + Paneer Chilli = Street Hit',
    candidateIdsVeg: ['item-mc-1-paneer', 'item-vs-5', 'item-vs-6', 'item-bv-6'],
    candidateIdsNonVeg: ['item-mc-1-chicken', 'item-cs-4', 'item-cs-1', 'item-bv-6'],
  },

  // 14. Beverages & Mocktails
  {
    anchorCategory: 'beverages',
    tag: 'Adda Munchies Match',
    socialProofNonVeg: '🔥 89% PAIR THEIR SIPS WITH HOT MOMOS',
    socialProofVeg: '⭐ 87% GRAB A CRISPY SNACK WITH DRINKS',
    headlineNonVeg: 'Complete Your Chilled Drink With Hot Bites!',
    headlineVeg: 'Add A Crispy Bite To Your Refreshment!',
    pitchNonVeg: 'Add Steamed Chicken Momos or Popcorn',
    pitchVeg: 'Add Steamed Veg Momos or Golden Fries',
    sensoryNonVeg: 'Hot, freshly steamed Himalayan dumplings with fiery red chutney — the ultimate companion while you sip your chilled drink.',
    sensoryVeg: 'Piping hot, delicate steamed momos served with spicy garlic dip, transforming a simple drink into an authentic adda session.',
    comboTagNonVeg: 'Chilled Drink + Hot Momos = Perfect Adda',
    comboTagVeg: 'Refreshing Sip + Steamed Momos = Adda Companion',
    candidateIdsVeg: ['item-mm-1-steam', 'item-vs-1', 'san-3', 'item-vs-3'],
    candidateIdsNonVeg: ['item-mm-3-steam', 'item-cs-1', 'san-9', 'item-cs-2'],
  },

  // 15. Milkshakes & Lassis
  {
    anchorCategory: 'shakes_lassi',
    tag: 'Sweet & Savory Match',
    socialProofNonVeg: '🔥 88% PAIR THICK SHAKES WITH HOT POPCORN',
    socialProofVeg: '⭐ 90% ADD CRISPY FRIES TO THEIR SHAKE',
    headlineNonVeg: 'The Ultimate Sweet & Savory Duo!',
    headlineVeg: 'Creamy Shake Meets Golden Fries!',
    pitchNonVeg: 'Add Crispy Chicken Popcorn or Cheese Sandwich',
    pitchVeg: 'Add Golden French Fries or Cheese Sandwich',
    sensoryNonVeg: 'Crunchy, hot chicken popcorn seasoned with herbs provides the ultimate savory contrast to your thick, luscious shake.',
    sensoryVeg: 'Crispy salted fries to dip or enjoy alongside a thick, velvety ice-cream blended shake.',
    comboTagNonVeg: 'Thick Shake + Savory Popcorn = Dream Pair',
    comboTagVeg: 'Thick Shake + Crisp Fries = Sweet & Salty Hit',
    candidateIdsVeg: ['item-vs-1', 'san-3', 'item-mm-1-steam', 'bur-2'],
    candidateIdsNonVeg: ['item-cs-1', 'san-9', 'item-mm-3-steam', 'bur-6'],
  },

  // 16. Tea & Coffee
  {
    anchorCategory: 'tea_coffee',
    tag: 'Bistro Coffee Break',
    socialProofNonVeg: '🔥 91% ORDER A GRILLED BITE WITH COFFEE',
    socialProofVeg: '⭐ 93% ENJOY WITH A TOASTED SANDWICH',
    headlineNonVeg: 'Complete Your Bistro Coffee Break!',
    headlineVeg: 'The Classic Coffee & Sandwich Pair!',
    pitchNonVeg: 'Add Grilled Chicken Cheese Sandwich or Popcorn',
    pitchVeg: 'Add Grilled Cheese Corn Sandwich or Fries',
    sensoryNonVeg: 'Warm shredded chicken tossed with herb mayo and melting cheese in crisp toasted artisan bread slices alongside your brew.',
    sensoryVeg: 'American sweet corn and double melting mozzarella grilled golden-brown inside herb-buttered toast — made for hot or cold coffee.',
    comboTagNonVeg: 'Bistro Coffee + Chicken Grill = Perfect Break',
    comboTagVeg: 'Bistro Coffee + Corn Melt = Tea-Time Perfection',
    candidateIdsVeg: ['san-3', 'item-vs-1', 'san-2', 'mag-2'],
    candidateIdsNonVeg: ['san-9', 'item-cs-1', 'item-cs-2', 'mag-7'],
  },
];

// Anti-spam cooldown keys
export const UPSELL_SESSION_DISMISSED_KEY = 'sg_upsell_dismissed_session';
export const UPSELL_LAST_TIMESTAMP_KEY = 'sg_upsell_last_time';
export const UPSELL_ACCEPTED_KEY = 'sg_upsell_accepted';
const COOLDOWN_SECONDS = 75; // 75 seconds between spotlight recommendations
const MAX_SESSION_PILL_SHOWS = 4;

/**
 * Check if the customer has already accepted an upsell suggestion in this session
 */
export function hasAcceptedAnyUpsell(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(UPSELL_ACCEPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Record that an upsell suggestion was accepted
 */
export function recordUpsellAccepted(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(UPSELL_ACCEPTED_KEY, 'true');
  } catch {}
}

/**
 * Reset upsell accepted state (e.g., when cart is completely cleared)
 */
export function resetUpsellAccepted(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(UPSELL_ACCEPTED_KEY);
  } catch {}
}

/**
 * Check if session is eligible for a floating suggestion
 */
export function isEligibleForUpsellPill(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. If customer has already accepted an upsell, DO NOT show more suggestions (no forcing)
    if (sessionStorage.getItem(UPSELL_ACCEPTED_KEY) === 'true') {
      return false;
    }

    // 2. Did the customer explicitly dismiss a suggestion pill this session?
    if (sessionStorage.getItem(UPSELL_SESSION_DISMISSED_KEY) === 'true') {
      return false;
    }

    // 3. Check total pills shown this session
    const count = parseInt(sessionStorage.getItem('sg_upsell_count') || '0', 10);
    if (count >= MAX_SESSION_PILL_SHOWS) {
      return false;
    }

    // 4. Check cooldown time
    const lastTime = parseInt(sessionStorage.getItem(UPSELL_LAST_TIMESTAMP_KEY) || '0', 10);
    const now = Date.now();
    if (now - lastTime < COOLDOWN_SECONDS * 1000) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Record that a suggestion pill was shown
 */
export function recordUpsellPillShown(): void {
  if (typeof window === 'undefined') return;
  try {
    const count = parseInt(sessionStorage.getItem('sg_upsell_count') || '0', 10);
    sessionStorage.setItem('sg_upsell_count', String(count + 1));
    sessionStorage.setItem(UPSELL_LAST_TIMESTAMP_KEY, String(Date.now()));
  } catch {}
}

/**
 * Permanently mute floating pills for this session upon explicit user close
 */
export function muteUpsellPillForSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(UPSELL_SESSION_DISMISSED_KEY, 'true');
  } catch {}
}

function getRecommendationCopy(
  candidate: ExtendedMenuItem,
  anchorItemName: string,
  rule: PairingRule,
  isStrictlyVeg: boolean
): {
  headline: string;
  pitch: string;
  sensoryDescription: string;
  socialProof: string;
  comboTag: string;
} {
  const cat = (candidate.category || '').toLowerCase();
  const candName = candidate.name;

  if (cat === 'sandwich') {
    return {
      headline: isStrictlyVeg ? 'The Classic Coffee & Sandwich Pair!' : 'Elevate With A Grilled Chicken Sandwich!',
      pitch: `Add ${candName}`,
      sensoryDescription:
        candidate.description ||
        'Golden-brown butter-toasted sandwich with melting cheese and seasoned fillings.',
      socialProof: '⭐ 93% ENJOY WITH A TOASTED SANDWICH',
      comboTag: `${anchorItemName} + ${candName}`,
    };
  }

  if (candidate.id === 'item-vs-1' || candName.toLowerCase().includes('fries')) {
    return {
      headline: 'Crispy Golden Crunch For Your Sip!',
      pitch: `Add ${candName}`,
      sensoryDescription:
        'Hot, freshly fried golden potato fries lightly salted to crunch on between creamy sips.',
      socialProof: '🔥 91% PAIR WITH CRISPY GOLDEN FRIES',
      comboTag: `${anchorItemName} + Golden Fries`,
    };
  }

  if (cat === 'momos') {
    return {
      headline: isStrictlyVeg ? 'Steamed Himalayan Dumplings' : 'Juicy Steamed Chicken Momos',
      pitch: `Add ${candName}`,
      sensoryDescription:
        candidate.description ||
        'Delicate dumplings served piping hot with fiery red chutney and clear herbal broth.',
      socialProof: '🔥 89% LOVE STEAMED MOMOS WITH THIS',
      comboTag: `${anchorItemName} + Hot Momos`,
    };
  }

  if (cat === 'maggi') {
    return {
      headline: 'Hot & Spiced Cafe Maggi Bowl',
      pitch: `Add ${candName}`,
      sensoryDescription:
        candidate.description ||
        'Steaming hot butter-tossed noodles with house masala and rich melted cheese.',
      socialProof: '⭐ 92% STUDENTS PAIR WITH SPICY MAGGI',
      comboTag: `${anchorItemName} + Cheesy Maggi`,
    };
  }

  if (cat === 'starters') {
    return {
      headline: isStrictlyVeg ? 'Crispy Golden Starter' : 'Hot Crunchy Chicken Popcorn',
      pitch: `Add ${candName}`,
      sensoryDescription:
        candidate.description ||
        'Crunchy, seasoned finger snacks fresh out of the fryer with zesty dipping sauce.',
      socialProof: isStrictlyVeg ? '⭐ 90% ADD A CRISPY SNACK' : '🔥 94% PAIR WITH CRUNCHY BITES',
      comboTag: `${anchorItemName} + Crispy Bites`,
    };
  }

  if (isDrinkCategory(cat)) {
    return {
      headline: 'The Ultimate Chilled Palate Cleanser!',
      pitch: `Add ${candName}`,
      sensoryDescription:
        candidate.description ||
        'Chilled refreshing cooler served over ice cubes with mint and lime.',
      socialProof: '⭐ 92% OF GUESTS ADD A CHILLED SIP',
      comboTag: `${anchorItemName} + Chilled Sip`,
    };
  }

  return {
    headline: isStrictlyVeg ? rule.headlineVeg : rule.headlineNonVeg,
    pitch: `Add ${candName}`,
    sensoryDescription: candidate.description || (isStrictlyVeg ? rule.sensoryVeg : rule.sensoryNonVeg),
    socialProof: isStrictlyVeg ? rule.socialProofVeg : rule.socialProofNonVeg,
    comboTag: `${anchorItemName} + ${candName}`,
  };
}

/**
 * Core "Sales Genius" recommendation finder for an anchor item being added
 */
export function findSmartUpsell({
  newlyAddedItem,
  cartItems,
  allMenuItems,
}: {
  newlyAddedItem: { id: string; name?: string; category?: string; isVeg?: boolean };
  cartItems: CartItem[];
  allMenuItems: ExtendedMenuItem[];
}): UpsellRecommendation | null {
  if (!newlyAddedItem || !allMenuItems || allMenuItems.length === 0) return null;

  // Determine dietary profile: If entire cart is vegetarian, STRICTLY recommend vegetarian items
  const hasNonVegInCart = cartItems.some((ci) => ci.variant === 'non-veg') || newlyAddedItem.isVeg === false;
  const isStrictlyVeg = !hasNonVegInCart;

  // Determine if order already contains a drink
  const hasDrinkInOrder =
    isDrinkCategory(newlyAddedItem.category) ||
    cartItems.some((ci) => isDrinkCategory(ci.category));

  // Find matching pairing rule for the anchor item
  const rule = PAIRING_RULES.find((r) => {
    if (r.anchorItemIds && r.anchorItemIds.includes(newlyAddedItem.id)) return true;
    if (r.anchorCategory && r.anchorCategory === newlyAddedItem.category) return true;
    return false;
  });

  if (!rule) return null;

  const candidateIds = isStrictlyVeg ? rule.candidateIdsVeg : rule.candidateIdsNonVeg;
  const inCartItemIds = new Set(cartItems.map((ci) => ci.itemId));
  inCartItemIds.add(newlyAddedItem.id);

  const menuMap = new Map(allMenuItems.map((m) => [m.id, m]));

  // Pick the first available candidate that is NOT already in the cart and matches dietary rules
  for (const cid of candidateIds) {
    if (inCartItemIds.has(cid)) continue;

    const candidate = menuMap.get(cid);
    if (!candidate) continue;

    // Check availability
    if (candidate.isAvailable === false) continue;

    // Check dietary match
    if (isStrictlyVeg && !candidate.isVeg) continue;

    // If order already has a drink, NEVER recommend another drink!
    if (hasDrinkInOrder && isDrinkCategory(candidate.category)) continue;

    const meta = getRecommendationCopy(candidate, newlyAddedItem.name || 'Your Dish', rule, isStrictlyVeg);

    return {
      recommendedItem: candidate,
      anchorItemName: newlyAddedItem.name || 'Your Dish',
      headline: meta.headline,
      pitch: meta.pitch,
      sensoryDescription: meta.sensoryDescription,
      socialProof: meta.socialProof,
      comboTag: meta.comboTag,
      tag: rule.tag,
    };
  }

  return null;
}

/**
 * Get complementary recommendations to display in the Order Modal ("Frequently Paired Together")
 * Returns up to 2 high-converting items based on cart contents
 */
export function getCartComplements({
  cartItems,
  allMenuItems,
}: {
  cartItems: CartItem[];
  allMenuItems: ExtendedMenuItem[];
}): UpsellRecommendation[] {
  if (!cartItems.length || !allMenuItems.length) return [];

  // 1. If the user has already accepted a suggestion, DO NOT show more inside the cart (no forcing)
  if (hasAcceptedAnyUpsell()) {
    return [];
  }

  const inCartItemIds = new Set(cartItems.map((ci) => ci.itemId));

  // 2. If the cart already contains an anchor item and any of its natural complements,
  // the meal is already complete! Avoid showing more suggestions to keep the experience subtle.
  for (const cartItem of cartItems) {
    const rule = PAIRING_RULES.find((r) => {
      if (r.anchorItemIds && r.anchorItemIds.includes(cartItem.itemId)) return true;
      if (r.anchorCategory && r.anchorCategory === cartItem.category) return true;
      return false;
    });

    if (rule) {
      const allCandidates = [...rule.candidateIdsVeg, ...rule.candidateIdsNonVeg];
      const hasComplementInCart = allCandidates.some((cid) => inCartItemIds.has(cid));
      if (hasComplementInCart) {
        return []; // Combo already formed! Keep it clean and unforced.
      }
    }
  }

  const hasNonVeg = cartItems.some((ci) => ci.variant === 'non-veg');
  const isStrictlyVeg = !hasNonVeg;

  // Check if cart already has ANY drink
  const hasDrinkInCart = cartItems.some((ci) => isDrinkCategory(ci.category));

  const menuMap = new Map(allMenuItems.map((m) => [m.id, m]));
  const recommendations: UpsellRecommendation[] = [];
  const chosenIds = new Set<string>();

  const tryAddCandidate = (cid: string, anchorItemName: string, rule: PairingRule): boolean => {
    if (inCartItemIds.has(cid) || chosenIds.has(cid)) return false;

    const candidate = menuMap.get(cid);
    if (!candidate || candidate.isAvailable === false) return false;
    if (isStrictlyVeg && !candidate.isVeg) return false;

    const candidateIsDrink = isDrinkCategory(candidate.category);

    // Rule A: If cart already has a drink, NEVER recommend another drink!
    if (hasDrinkInCart && candidateIsDrink) return false;

    // Rule B: Never recommend 2 drinks simultaneously in the order tray!
    const alreadyHasDrink = recommendations.some((r) => isDrinkCategory(r.recommendedItem.category));
    if (alreadyHasDrink && candidateIsDrink) return false;

    const meta = getRecommendationCopy(candidate, anchorItemName, rule, isStrictlyVeg);

    recommendations.push({
      recommendedItem: candidate,
      anchorItemName,
      headline: meta.headline,
      pitch: meta.pitch,
      sensoryDescription: meta.sensoryDescription,
      socialProof: meta.socialProof,
      comboTag: meta.comboTag,
      tag: rule.tag,
    });

    chosenIds.add(cid);
    return true;
  };

  // Phase 1: Check each cart item against pairing rules (1 item each if cart has multiple dishes)
  for (const cartItem of cartItems) {
    const rule = PAIRING_RULES.find((r) => {
      if (r.anchorItemIds && r.anchorItemIds.includes(cartItem.itemId)) return true;
      if (r.anchorCategory && r.anchorCategory === cartItem.category) return true;
      return false;
    });

    if (!rule) continue;

    const candidateIds = isStrictlyVeg ? rule.candidateIdsVeg : rule.candidateIdsNonVeg;

    for (const cid of candidateIds) {
      if (tryAddCandidate(cid, cartItem.name, rule)) {
        if (recommendations.length >= 2) return recommendations;
        // If multiple dishes in cart, rotate through items first
        if (cartItems.length > 1) break;
      }
    }
  }

  // Phase 2: If we still need recommendations, check secondary candidates from primary items
  if (recommendations.length < 2) {
    for (const cartItem of cartItems) {
      const rule = PAIRING_RULES.find((r) => {
        if (r.anchorItemIds && r.anchorItemIds.includes(cartItem.itemId)) return true;
        if (r.anchorCategory && r.anchorCategory === cartItem.category) return true;
        return false;
      });

      if (!rule) continue;

      const candidateIds = isStrictlyVeg ? rule.candidateIdsVeg : rule.candidateIdsNonVeg;

      for (const cid of candidateIds) {
        if (tryAddCandidate(cid, cartItem.name, rule)) {
          if (recommendations.length >= 2) return recommendations;
        }
      }
    }
  }

  // Phase 3: Intelligent Fallback (strictly excluding drinks if cart has drinks or recommendation already has a drink)
  if (recommendations.length < 2) {
    const popularFallbacks = hasDrinkInCart
      ? (isStrictlyVeg
          ? ['item-vs-1', 'san-3', 'item-mm-1-steam', 'mag-2', 'item-vs-5']
          : ['item-cs-1', 'san-9', 'item-mm-3-steam', 'item-cs-2', 'mag-7'])
      : (isStrictlyVeg
          ? ['san-3', 'item-vs-1', 'item-bv-6', 'item-mm-1-steam']
          : ['item-cs-1', 'san-9', 'item-bv-6', 'item-mm-3-steam']);

    for (const fid of popularFallbacks) {
      if (inCartItemIds.has(fid) || chosenIds.has(fid)) continue;
      const candidate = menuMap.get(fid);
      if (!candidate || candidate.isAvailable === false) continue;
      if (isStrictlyVeg && !candidate.isVeg) continue;

      const candidateIsDrink = isDrinkCategory(candidate.category);
      if (hasDrinkInCart && candidateIsDrink) continue;
      const alreadyHasDrink = recommendations.some((r) => isDrinkCategory(r.recommendedItem.category));
      if (alreadyHasDrink && candidateIsDrink) continue;

      const fallbackRule: PairingRule = {
        tag: 'Popular Pair',
        socialProofVeg: '⭐ 92% LOVE THIS COMBO',
        socialProofNonVeg: '🔥 94% COMPLETE THEIR ORDER WITH THIS',
        headlineVeg: 'Popular Cafe Add-On',
        headlineNonVeg: "Chef's Special Add-On",
        pitchVeg: `Add ${candidate.name}`,
        pitchNonVeg: `Add ${candidate.name}`,
        sensoryVeg: candidate.description || 'Freshly made cafe specialty.',
        sensoryNonVeg: candidate.description || 'Freshly made cafe specialty.',
        comboTagVeg: 'Customer Favorite',
        comboTagNonVeg: 'Customer Favorite',
        candidateIdsVeg: [],
        candidateIdsNonVeg: [],
      };

      const meta = getRecommendationCopy(candidate, cartItems[0]?.name || 'Your Order', fallbackRule, isStrictlyVeg);

      recommendations.push({
        recommendedItem: candidate,
        anchorItemName: cartItems[0]?.name || 'Your Order',
        headline: meta.headline,
        pitch: meta.pitch,
        sensoryDescription: meta.sensoryDescription,
        socialProof: meta.socialProof,
        comboTag: meta.comboTag,
        tag: 'Popular Pair',
      });
      chosenIds.add(fid);
      if (recommendations.length >= 2) break;
    }
  }

  return recommendations;
}
