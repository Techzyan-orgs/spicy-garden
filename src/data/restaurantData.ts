export interface MenuItem {
  id: string;
  name: string;
  category: string; // category id from the live menu (database)
  price: number;
  chickenPrice?: number; // for items with veg/chicken options (e.g. Pasta)
  isVeg: boolean;
  isSpicy?: boolean;
  isBestSeller?: boolean;
  isSpecial?: boolean;
  description: string;
  image?: string;
  image_url?: string;
  tags?: string[];
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  date: string;
  isoDate?: string;
  comment: string;
  favoriteDish?: string;
}

export interface USPItem {
  id: string;
  title: string;
  description: string;
  iconName: 'Sparkles' | 'Tv' | 'Utensils' | 'Users' | 'HeartHandshake' | 'Clock' | 'ShieldCheck';
  highlight: string;
}

export interface OccasionItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  icon: 'Cake' | 'Heart' | 'PartyPopper' | 'Briefcase' | 'Smile';
}

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  category: 'food' | 'ambiance' | 'celebration';
  title: string;
  description: string;
}

export interface MenuCategory {
  id: string;
  label: string;
  icon: string;
  subtitle?: string;
  description?: string;
  image?: string;
}

export interface PrintedMenuPage {
  pageNumber: number;
  title: string;
  tag: string;
  categorySummary: string;
  image: string;
  downloadName: string;
  highlights: string[];
}

export const RESTAURANT_DATA = {
  heroSpotlight: {
    tag: "Oven-Fresh Favorite",
    title: "Gourmet Handcrafted Pizzas",
    priceLabel: "Starting at",
    price: "₹149"
  },

  brand: {
    name: "The Spicy Garden - Cafe & Bistro",
    shortName: "The Spicy Garden",
    altName: "Spicy Garden Cafe & Resto",
    tagline: "You Celebrate, We Take Care!",
    secondaryTagline: "Good Food. Good Mood.",
    motto: "Delicious Food • Warm Ambience • Memorable Moments",
    foundedYear: "2023",
    description: "Welcome to The Spicy Garden Cafe & Bistro — Baguiati's favorite hangout for mouth-watering gourmet pizzas, handcrafted pastas, juicy burgers, comforting Maggi, street-style Chinese combos, and Tibetan momos. Adorned with beautiful Asian art murals, comfortable air-conditioned seating, and pocket-friendly pricing, we make every dining experience and celebration unforgettable.",
    mission: "To serve freshly prepared, flavorful comfort food in a vibrant, welcoming cafe environment where friends, families, and colleagues can gather, celebrate, and unwind without breaking the bank."
  },

  contact: {
    phone: "8777866602",
    displayPhone: "+91 87778 66602",
    telLink: "tel:+918777866602",
    whatsappNumber: "918777866602",
    whatsappLink: "https://wa.me/918777866602?text=Hi%20The%20Spicy%20Garden!%20I%20would%20like%20to%20place%20an%20order%20or%20inquire%20about%20a%20table%20reservation.",
    whatsappPartyLink: "https://wa.me/918777866602?text=Hello%20The%20Spicy%20Garden!%20I%20would%20like%20to%20book%20a%20party%20celebration%20(Birthday%2FAnniversary%2FKitty%2FOffice).",
    email: "thespicygarden.kolkata@gmail.com",
    address: {
      street: "1/G-1, Ashwini Nagar",
      locality: "Baguiati",
      city: "Kolkata",
      state: "West Bengal",
      postalCode: "700159",
      country: "India",
      landmark: "Near VIP Road, Ashwini Nagar Auto Stand / Baguiati",
      fullAddress: "1/G-1, Ashwini Nagar, Baguiati, Kolkata, West Bengal 700159, India"
    },
    geo: {
      latitude: 22.6186,
      longitude: 88.4287,
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=The+Spicy+Garden+Baguiati+Kolkata",
      directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=The+Spicy+Garden+Baguiati+Kolkata",
      embedMapUrl: "https://maps.google.com/maps?q=The+Spicy+Garden,+1/G-1,+Ashwini+Nagar,+Baguiati,+Kolkata,+West+Bengal+700159&t=&z=17&ie=UTF8&iwloc=&output=embed"
    },
    socials: {
      instagram: {
        handle: "@thespicygarden76_baguiati",
        url: "https://www.instagram.com/thespicygarden76_baguiati/",
        displayText: "thespicygarden76_baguiati"
      }
    }
  },


  assets: {
    logo: "/unnamed (1).webp",
    heroPizza: "/unnamed (2).webp",
    burger: "/unnamed (3).webp",
    chineseSpread: "/unnamed (4).webp",
    chickenTenders: "/unnamed (5).webp",
    steamedMomos: "/unnamed (6).webp",
    diningHallMural: "/unnamed (7).webp",
    ramenMuralDining: "/unnamed (8).webp",
    geishaWallArt: "/unnamed (9).webp",
    cafeAmbianceTv: "/unnamed (10).webp",
    storefrontBanner: "/unnamed (11).webp",
    menuCardFull: "/menu.png",
    menuCardWebp: "/menu.webp",
    menuPages: [
      {
        pageNumber: 1,
        title: "Fast Food & Cafe Specials",
        tag: "Cafe & Fast Food",
        categorySummary: "Pizzas, Pastas, Burgers, Sandwiches & Maggi",
        image: "/menu.webp",
        downloadName: "The_Spicy_Garden_Menu_Page_1_FastFood.webp",
        highlights: [
          "11 Golden Handcrafted Crust Pizzas (₹149 - ₹289)",
          "Creamy Alfredo, Red Sauce & Baked Pastas",
          "Gourmet Sesame Cutlet Burgers & King Kong Burgers",
          "Triple-Decker Toasted Club Sandwiches",
          "Kolkata Street-Style Spiced Maggi Bowls",
        ],
      },
      {
        pageNumber: 2,
        title: "Starters, Momos & Soups",
        tag: "Starters & Soups",
        categorySummary: "Chicken, Fish & Veg Appetizers, Tibetan Momos, Fresh Salads & Warm Soups",
        image: "/menu_03.png",
        downloadName: "The_Spicy_Garden_Menu_Page_2_Starters_Momos.png",
        highlights: [
          "Chicken Drums of Heaven [6 PCS] & Chicken Popcorn",
          "Fish Fry [1 PC], Fish Fingers [4 PCS] & Butter Garlic Prawns",
          "Golden Chilli Baby Corn & Cheesy Mushroom",
          "Steamed, Fried & Kurkure Momos [5 PCS]",
          "Manchow, Sweet Corn, Hot & Sour Broths & Fresh Salads",
        ],
      },
      {
        pageNumber: 3,
        title: "Chinese Main Course, Rice & Noodles",
        tag: "Chinese & Wok",
        categorySummary: "Sizzling Gravies, Wok Fried Rice, Hakka Noodles & Laccha Paratha",
        image: "/menu_02.png",
        downloadName: "The_Spicy_Garden_Menu_Page_3_MainCourse_Rice_Noodles.png",
        highlights: [
          "Chilli, Manchurian, Schezwan & Kung Pao [8 PCS] in 5 Proteins",
          "Wok Tossed Fried Rice, Schezwan, Burnt Garlic & Lemongrass",
          "Kolkata Hakka, Gravy, Singapore & Cantonese Noodles",
          "Fresh Multi-Layered Laccha Paratha (₹29)",
        ],
      },
      {
        pageNumber: 4,
        title: "Beverages, Shakes & Brews",
        tag: "Brews & Beverages",
        categorySummary: "Tea, Coffee, Thick Milk Shakes, Chilled Lassis & Refreshing Coolers",
        image: "/menu_04.png",
        downloadName: "The_Spicy_Garden_Menu_Page_4_Beverages_Shakes.png",
        highlights: [
          "KitKat, Oreo, Blueberry & Kesar Badam Thick Shakes",
          "Authentic Chilled Mango, Kesar Badam & Rose Lassis",
          "Virgin Mojito, Blue Blossom & Kiwi Margarita Coolers",
          "Hot & Cold Brewed Coffees, Ice Cream Blends & Velvety Hot Chocolate",
        ],
      },
    ] as PrintedMenuPage[],
    sandwich: "/sandwich.webp",
    pasta: "/pasta.webp",
    maggi: "/maggi.webp"
  },

  assetPlaceholders: {
    default: "data:image/webp;base64,UklGRlgAAABXRUJQVlA4IEwAAADwAQCdASoKAAgABABoJbACdAEQz4HbYwAA9lb7wGcMl//WYDvRJsht5vq2iiUhuxYj7QffcbBdCSlMTu35XFxmd+CtvhjtFpqpH+AA",
    heroPizza: "data:image/webp;base64,UklGRlgAAABXRUJQVlA4IEwAAADwAQCdASoKAAgABABoJbACdAEQz4HbYwAA9lb7wGcMl//WYDvRJsht5vq2iiUhuxYj7QffcbBdCSlMTu35XFxmd+CtvhjtFpqpH+AA",
    logo: "data:image/webp;base64,UklGRk4AAABXRUJQVlA4IEIAAADQAQCdASoKAAgABABoJbACdAEyqD/vYAAA/v3861uD+lGj0f477TjM5y6o4tJvXwP21D2bK9T4K86K63K2X8gA",
    momos: "data:image/webp;base64,UklGRk4AAABXRUJQVlA4IEIAAADQAQCdASoKAAgABABoJbACdAEyqD/vYAAA/v3861uD+lGj0f477TjM5y6o4tJvXwP21D2bK9T4K86K63K2X8gA",
    burger: "data:image/webp;base64,UklGRk4AAABXRUJQVlA4IEIAAADQAQCdASoKAAgABABoJbACdAEyqD/vYAAA/v3861uD+lGj0f477TjM5y6o4tJvXwP21D2bK9T4K86K63K2X8gA"
  },

  stats: {
    averageRating: "4.8",
    totalReviews: "95+",
    pricePerPerson: "₹150 – ₹300",
    seatingCapacity: "35+ Guests",
    dishesServed: "60+ Fresh Varieties"
  },

  usps: [
    {
      id: "usp-1",
      title: "Handcrafted & Cooked Fresh",
      description: "Every pizza, burger, pasta, and momo is made fresh upon order with pure ingredients, real cheese, and signature spice blends.",
      iconName: "Utensils",
      highlight: "100% Freshly Prepared"
    },
    {
      id: "usp-2",
      title: "Pocket-Friendly Goodness",
      description: "Premium cafe-style flavors and generous portions at budget-friendly student and family prices starting from just ₹69.",
      iconName: "Sparkles",
      highlight: "From Just ₹69"
    },
    {
      id: "usp-3",
      title: "Cozy AC Ambiance & Murals",
      description: "Chic modern decor featuring hand-painted oriental wall murals, soft ambient lighting, and fully air-conditioned comfortable seating.",
      iconName: "HeartHandshake",
      highlight: "Instagrammable Decor"
    },
    {
      id: "usp-5",
      title: "All-Occasion Party Specialists",
      description: "Celebrate birthdays, anniversaries, kitty parties, or corporate team outings with customized party food platters and dedicated assistance.",
      iconName: "Users",
      highlight: "You Celebrate, We Take Care"
    }
  ] as USPItem[],

  occasions: [
    {
      id: "birthday",
      title: "Birthday Bashes",
      subtitle: "Unforgettable Parties with Loved Ones",
      description: "From intimate birthday gatherings to buzzing gang parties, we set up the tables, prepare festive platters, and keep the food flowing.",
      benefits: ["Customized food combos & platters", "Flexible seating arrangements", "Music & celebratory vibe"],
      icon: "Cake"
    },
    {
      id: "anniversary",
      title: "Anniversaries & Date Nights",
      subtitle: "Romantic & Cozy Bistro Setting",
      description: "Enjoy intimate candlelit vibes under our warm ambient lighting, sharing artisanal pastas, crispy thin pizzas, and mocktail coolers.",
      benefits: ["Warm pendant ambient lighting", "Peaceful & air-conditioned setting", "Special couple meal combos"],
      icon: "Heart"
    },
    {
      id: "kitty",
      title: "Kitty Parties & Socials",
      subtitle: "Afternoon Giggles & Delectable Bites",
      description: "Gather your friends for an afternoon of endless gossip, steaming coffee, cheesy club sandwiches, and spicy garlic Maggi bowls.",
      benefits: ["Dedicated seating zone", "Easy sharing snacks & beverages", "Comfortable relaxed ambiance"],
      icon: "PartyPopper"
    },
    {
      id: "office",
      title: "Office Parties & Team Hangouts",
      subtitle: "Unwind After Work with Teammates",
      description: "Reward your team after a successful project sprint or celebrate office milestones with group meals and live match screenings.",
      benefits: ["Quick service for team lunches", "Beverage & starter packages", "Big screen entertainment"],
      icon: "Briefcase"
    }
  ] as OccasionItem[],

  gallery: [
    {
      id: "gal-1",
      src: "/unnamed (2).webp",
      alt: "Loaded Cheese Gourmet Pizza with Olives, Bell Peppers and Fresh Herbs",
      category: "food",
      title: "Signature Gourmet Pizza",
      description: "Handcrafted thin crust pizza smothered with premium cheese, black olives, crisp bell peppers, and signature herbs."
    },
    {
      id: "gal-2",
      src: "/unnamed (7).webp",
      alt: "Spicy Garden Cafe Dining Hall featuring Orange Seating and Beijing Opera Mural",
      category: "ambiance",
      title: "Vibrant Main Dining Hall",
      description: "Fully air-conditioned dining lounge with stylish orange chairs, brick accenting, and hand-painted Asian wall mural."
    },
    {
      id: "gal-3",
      src: "/unnamed (6).webp",
      alt: "Tibetan Steamed Momos served with Clear Soup Broth and Spicy Chutney Dip",
      category: "food",
      title: "Authentic Steamed Momos",
      description: "Delicately pleated momos served steaming hot alongside seasoned clear chicken or vegetable broth and fiery red chilli chutney."
    },
    {
      id: "gal-4",
      src: "/unnamed (8).webp",
      alt: "Artistic Ramen Noodle and Flying Chopsticks Wall Mural in the Cafe Dining Room",
      category: "ambiance",
      title: "Ramen Art Wall & Booths",
      description: "Playful culinary art mural depicting flying ramen noodles and Japanese chopsticks, a favorite guest photo spot."
    },
    {
      id: "gal-5",
      src: "/unnamed (4).webp",
      alt: "Indo-Chinese Fried Rice and Tangy Chilli Chicken Sizzling Platter",
      category: "food",
      title: "Chinese Combo Feast",
      description: "Wok-tossed aromatic fried rice bowls paired with sizzling spicy chilli chicken gravy and bell peppers."
    },
    {
      id: "gal-6",
      src: "/unnamed (10).webp",
      alt: "Spicy Garden Cafe Interior with Live Match TV and Reading Quote Wall",
      category: "ambiance",
      title: "Lounge with Live Match TV",
      description: "Spacious layout with wall quotes, cozy book display, and wall-mounted screen for live match screening."
    },
    {
      id: "gal-7",
      src: "/unnamed (5).webp",
      alt: "Golden Crispy Fried Chicken Tenders with Schezwan Dipping Sauce",
      category: "food",
      title: "Crispy Golden Tenders",
      description: "Crunchy crumb-coated chicken strips fried to golden perfection, served with spicy home-style dip."
    },
    {
      id: "gal-8",
      src: "/unnamed (3).webp",
      alt: "Grilled Cheese Burger with Fresh Lettuce and Layered Patties",
      category: "food",
      title: "Stacked Grilled Burger",
      description: "Toasted sesame bun with a crispy cutlet patty, melted cheese slice, crisp iceberg lettuce, and special bistro sauce."
    },
    {
      id: "gal-9",
      src: "/unnamed (9).webp",
      alt: "Warm Ambient Light illuminating the Geisha Wall Mural at Night",
      category: "ambiance",
      title: "Evening Bistro Vibes",
      description: "Cozy warm spot lighting highlighting the traditional Geisha mural, creating an intimate evening atmosphere."
    },
    {
      id: "gal-10",
      src: "/unnamed (11).webp",
      alt: "The Spicy Garden Cafe & Bistro Celebration Booking Storefront Board",
      category: "celebration",
      title: "Party & Occasion Hub",
      description: "Storefront celebration showcase inviting guests to book birthdays, anniversaries, kitty, and office parties."
    }
  ] as GalleryImage[],


  reviews: [
    {
      id: "rev-1",
      name: "Payel Chakraborty",
      rating: 5,
      date: "a month ago",
      isoDate: "2026-09-08",
      comment: "Decided to try this out instead of my usual spot in Baguiati. Everything was handled properly, warm, and straightforward. Got exactly what I was looking for. Really nice experience!",
      favoriteDish: "Snacks & Fast Food"
    },
    {
      id: "rev-2",
      name: "Jay Das",
      rating: 5,
      date: "3 weeks ago",
      isoDate: "2026-09-15",
      comment: "The food was awesome 🥰✌️ Delicious taste, good portion size, and great atmosphere. Must visit this place in Ashwini Nagar!",
      favoriteDish: "Mixed Sauce Pasta & Starters"
    },
    {
      id: "rev-3",
      name: "Sanjib Ghosh",
      rating: 5,
      date: "2 months ago",
      isoDate: "2026-08-05",
      comment: "First time experience but awesome! Delicious food, prompt service, and very pocket-friendly prices. Definitely coming back with friends.",
      favoriteDish: "Chilli Chicken & Noodles"
    },
    {
      id: "rev-4",
      name: "Sourabh Angaj",
      rating: 5,
      date: "a month ago",
      isoDate: "2026-09-01",
      comment: "Great food, the atmosphere is also very nice! I really liked the way the staff behaved—very polite and helpful. Budget-friendly cafe with generous portions. Definitely prefer to visit again.",
      favoriteDish: "Peri Peri Fries & Coolers"
    }
  ] as Review[],

  seo: {
    title: "The Spicy Garden - Cafe & Bistro | Baguiati Kolkata",
    metaDescription: "The Spicy Garden Cafe & Bistro in Ashwini Nagar, Baguiati, Kolkata. Delicious pizzas, pastas, burgers, Maggi, momos, and celebrations. Book birthdays & parties. Call 8777866602.",
    keywords: [
      "Spicy Garden Cafe & Resto",
      "The Spicy Garden Cafe & Bistro",
      "Cafe in Baguiati",
      "Restaurants in Ashwini Nagar Kolkata",
      "Best cafe near VIP road Kolkata",
      "Pocket friendly cafe Kolkata",
      "Birthday celebration cafe Baguiati",
      "Pizza burger momos Baguiati Kolkata",
      "The Spicy Garden 8777866602"
    ],
    canonicalUrl: "https://spicygardencafe.com",
    ogImage: "/unnamed (2).webp",
    locale: "en_IN",
    siteName: "The Spicy Garden Cafe & Bistro"
  }
};

/**
 * Helper to generate Schema.org JSON-LD structured data for Google Local Business
 */
export function getRestaurantStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "CafeOrCoffeeShop"],
    "@id": `${RESTAURANT_DATA.seo.canonicalUrl}/#restaurant`,
    "name": RESTAURANT_DATA.brand.name,
    "alternateName": [RESTAURANT_DATA.brand.shortName, RESTAURANT_DATA.brand.altName],
    "image": [
      `${RESTAURANT_DATA.seo.canonicalUrl}${RESTAURANT_DATA.assets.heroPizza}`,
      `${RESTAURANT_DATA.seo.canonicalUrl}${RESTAURANT_DATA.assets.diningHallMural}`,
      `${RESTAURANT_DATA.seo.canonicalUrl}${RESTAURANT_DATA.assets.storefrontBanner}`
    ],
    "logo": `${RESTAURANT_DATA.seo.canonicalUrl}${RESTAURANT_DATA.assets.logo}`,
    "url": RESTAURANT_DATA.seo.canonicalUrl,
    "telephone": RESTAURANT_DATA.contact.displayPhone,
    "email": RESTAURANT_DATA.contact.email,
    "priceRange": RESTAURANT_DATA.stats.pricePerPerson,
    "servesCuisine": ["Cafe", "Fast Food", "Italian", "Chinese", "Tibetan", "Continental"],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": RESTAURANT_DATA.contact.address.street,
      "addressLocality": RESTAURANT_DATA.contact.address.locality,
      "addressRegion": RESTAURANT_DATA.contact.address.state,
      "postalCode": RESTAURANT_DATA.contact.address.postalCode,
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": RESTAURANT_DATA.contact.geo.latitude,
      "longitude": RESTAURANT_DATA.contact.geo.longitude
    },
    // Opening hours are intentionally omitted: they live in the database (admin → Timings)
    // and Google reads them from the Google Business Profile.
    "sameAs": [
      RESTAURANT_DATA.contact.socials.instagram.url
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": RESTAURANT_DATA.stats.averageRating,
      "reviewCount": "95",
      "bestRating": "5",
      "worstRating": "1"
    },
    "hasMenu": `${RESTAURANT_DATA.seo.canonicalUrl}/#menu`,
    "acceptsReservations": "True"
  };
}

/**
 * Format an ISO date (e.g. "2026-09-15") into a human-readable relative time string
 * matching Google Maps formatting (e.g. "3 weeks ago", "2 months ago", "a year ago").
 */
export function formatRelativeTime(isoDateString: string): string {
  try {
    const targetDate = new Date(isoDateString);
    if (isNaN(targetDate.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - targetDate.getTime();
    if (diffMs < 0 || diffMs < 60 * 1000) return 'Just now';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins === 1 ? 'a minute ago' : `${diffMins} minutes ago`;
      }
      return diffHours === 1 ? 'an hour ago' : `${diffHours} hours ago`;
    }

    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffDays < 30) {
      return diffWeeks === 1 ? 'a week ago' : `${diffWeeks} weeks ago`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return diffMonths <= 1 ? 'a month ago' : `${diffMonths} months ago`;
    }

    const diffYears = Math.floor(diffDays / 365);
    return diffYears <= 1 ? 'a year ago' : `${diffYears} years ago`;
  } catch {
    return 'Recently';
  }
}

