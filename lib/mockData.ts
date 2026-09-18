export type ProductType = "Minted Bars" | "Cast Bars";
export type Availability = "In Stock" | "Low Stock" | "Out of Stock" | "Coming Soon";

export type BullionProduct = {
  id: string;
  brand: "Iconic Bullion" | "PAMP Suisse" | "Emirates Gold" | "ABC / Placeholder Brand" | "Aurelia Reserve" | "Generic";
  name: string;
  weightGrams: number;
  weightLabel: string;
  purity: string;
  type: ProductType;
  marginPercent: number;
  stock: number;
  availability: Availability;
  image: string;
  gallery: string[];
  iconicSerialEligible?: boolean;
  featured?: boolean;
};

export type MarketSnapshot = {
  audPerOz: number;
  usdPerOz: number;
  lastUpdated: string;
  marketOpen: boolean;
};

export const marketSnapshot: MarketSnapshot = {
  audPerOz: 6361.9,
  usdPerOz: 4252.3,
  lastUpdated: "10:35 AM",
  marketOpen: true
};

export const products: BullionProduct[] = [
  {
    id: "iconic-1g",
    brand: "Iconic Bullion",
    name: "1g Minted Gold Bar",
    weightGrams: 1,
    weightLabel: "1g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 9,
    stock: 64,
    availability: "In Stock",
    image: "/images/products/iconic-1g.webp",
    gallery: ["/images/products/iconic-1g.webp"],
    iconicSerialEligible: true,
    featured: true
  },
  {
    id: "iconic-5g",
    brand: "Iconic Bullion",
    name: "5g Minted Gold Bar",
    weightGrams: 5,
    weightLabel: "5g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 10,
    stock: 28,
    availability: "In Stock",
    image: "/images/products/iconic-5g.webp",
    gallery: ["/images/products/iconic-5g.webp"],
    iconicSerialEligible: true,
    featured: true
  },
  {
    id: "iconic-10g",
    brand: "Iconic Bullion",
    name: "10g Minted Gold Bar",
    weightGrams: 10,
    weightLabel: "10g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 9.5,
    stock: 12,
    availability: "Low Stock",
    image: "/images/products/iconic-10g.webp",
    gallery: ["/images/products/iconic-10g.webp", "/images/serial/iconic-bar-serial.jpg"],
    iconicSerialEligible: true,
    featured: true
  },
  {
    id: "premium-1g",
    brand: "Aurelia Reserve",
    name: "1g Minted Gold Bar",
    weightGrams: 1,
    weightLabel: "1g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 8.4,
    stock: 36,
    availability: "In Stock",
    image: "/images/products/premium-1g.webp",
    gallery: ["/images/products/premium-1g.webp"],
    featured: true
  },
  {
    id: "pamp-1g",
    brand: "PAMP Suisse",
    name: "1g Gold Bar",
    weightGrams: 1,
    weightLabel: "1g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 8,
    stock: 48,
    availability: "In Stock",
    image: "/images/products/pamp-1g-front.jpg",
    gallery: ["/images/products/pamp-1g-front.jpg", "/images/products/pamp-1g-back.jpg"],
    featured: false
  },
  {
    id: "pamp-5g",
    brand: "PAMP Suisse",
    name: "5g Gold Bar",
    weightGrams: 5,
    weightLabel: "5g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 8.5,
    stock: 16,
    availability: "In Stock",
    image: "/images/products/pamp-5g-front.jpg",
    gallery: ["/images/products/pamp-5g-front.jpg", "/images/products/pamp-1g-back.jpg"]
  },
  {
    id: "pamp-10g",
    brand: "PAMP Suisse",
    name: "10g Gold Bar",
    weightGrams: 10,
    weightLabel: "10g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 8,
    stock: 8,
    availability: "Low Stock",
    image: "/images/products/pamp-10g-front.jpg",
    gallery: ["/images/products/pamp-10g-front.jpg", "/images/products/pamp-1g-back.jpg"]
  },
  {
    id: "pamp-1oz",
    brand: "PAMP Suisse",
    name: "1oz Gold Bar",
    weightGrams: 31.1,
    weightLabel: "1oz / 31.1g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 6.8,
    stock: 7,
    availability: "Low Stock",
    image: "/images/products/pamp-1oz-front.jpg",
    gallery: ["/images/products/pamp-1oz-front.jpg", "/images/products/pamp-1g-back.jpg"]
  },
  {
    id: "emirates-10g",
    brand: "Emirates Gold",
    name: "10g Gold Bar",
    weightGrams: 10,
    weightLabel: "10g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 7.5,
    stock: 11,
    availability: "In Stock",
    image: "/images/products/emirates-10g-front.jpg",
    gallery: ["/images/products/emirates-10g-front.jpg", "/images/products/pamp-1g-back.jpg"]
  },
  {
    id: "emirates-20g",
    brand: "Emirates Gold",
    name: "20g Gold Bar",
    weightGrams: 20,
    weightLabel: "20g",
    purity: "999.9 Fine Gold",
    type: "Minted Bars",
    marginPercent: 7.2,
    stock: 5,
    availability: "Low Stock",
    image: "/images/products/emirates-10g-front.jpg",
    gallery: ["/images/products/emirates-10g-front.jpg", "/images/products/pamp-1g-back.jpg"]
  },
  {
    id: "cast-100g",
    brand: "Generic",
    name: "100g Cast Gold Bar",
    weightGrams: 100,
    weightLabel: "100g",
    purity: "999.9 Fine Gold",
    type: "Cast Bars",
    marginPercent: 5.8,
    stock: 4,
    availability: "In Stock",
    image: "/images/products/cast-100g.jpg",
    gallery: ["/images/products/cast-100g.jpg"]
  },
  {
    id: "cast-500g",
    brand: "Generic",
    name: "500g Cast Gold Bar",
    weightGrams: 500,
    weightLabel: "500g",
    purity: "999.9 Fine Gold",
    type: "Cast Bars",
    marginPercent: 4.6,
    stock: 1,
    availability: "Low Stock",
    image: "/images/products/cast-500g.jpg",
    gallery: ["/images/products/cast-500g.jpg"]
  },
  {
    id: "cast-1kg",
    brand: "Generic",
    name: "1kg Cast Gold Bar",
    weightGrams: 1000,
    weightLabel: "1kg",
    purity: "999.9 Fine Gold",
    type: "Cast Bars",
    marginPercent: 4.1,
    stock: 0,
    availability: "Out of Stock",
    image: "/images/products/cast-1kg.jpg",
    gallery: ["/images/products/cast-1kg.jpg"]
  },
  {
    id: "abc-250g",
    brand: "ABC / Placeholder Brand",
    name: "250g Cast Gold Bar",
    weightGrams: 250,
    weightLabel: "250g",
    purity: "999.9 Fine Gold",
    type: "Cast Bars",
    marginPercent: 5.1,
    stock: 0,
    availability: "Coming Soon",
    image: "/images/system/coming-soon.jpg",
    gallery: ["/images/system/coming-soon.jpg"]
  }
];

export const serialRegistry = {
  "IB-10G-000219": {
    product: "Iconic Bullion Gold Bar",
    weight: "10g",
    purity: "999.9 Fine Gold",
    serial: "IB-10G-000219",
    status: "Verified Genuine",
    issueDate: "18 September 2026"
  }
};

export const mockOrders = [
  {
    orderNo: "IB-10472",
    invoiceNo: "INV-2026-0188",
    date: "18 September 2026",
    amount: 2489.62,
    payment: "Pending for Payment",
    fulfilment: "Store Pickup",
    products: "Iconic Bullion 10g Minted Gold Bar"
  },
  {
    orderNo: "IB-10394",
    invoiceNo: "INV-2026-0169",
    date: "06 September 2026",
    amount: 1213.8,
    payment: "Paid",
    fulfilment: "Completed",
    products: "PAMP Suisse 5g Gold Bar"
  }
];

export const historicalGold = Array.from({ length: 30 }, (_, index) => {
  const wave = Math.sin(index / 3) * 42;
  const drift = index * 5.4;
  return {
    label: `${index + 1} Sep`,
    price: Math.round((6188 + drift + wave) * 100) / 100
  };
});
