"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type PointerEvent } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Barcode,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Lock,
  Menu,
  PackageCheck,
  Printer,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import { marketSnapshot, mockOrders, products, serialRegistry, type BullionProduct } from "@/lib/mockData";
import { marketPriceService, marketRanges, type HistoricalGoldPoint, type MarketRange } from "@/lib/marketData";
import {
  calculateBuyBackPrice,
  calculateCartLockedPrice,
  calculateProductBullionPrice,
  formatAUD,
  formatTimer,
  formatUSD,
  getGoldPricePerGram,
  TROY_OUNCE_GRAMS
} from "@/lib/pricing";

type VerificationState = "logged-out" | "unverified" | "pending" | "approved" | "declined";
type AccountType = "individual" | "company";
type CartLine = { productId: string; quantity: number; lockedPrice: number; lockedAt: number };
type Fulfilment = "pickup" | "delivery";
type KycStep = "overview" | "details" | "documents" | "review";
type KycDocumentMeta = { id: string; label: string; name: string; size: number; status: "uploaded" };

const memoryStore = new Map<string, string>();
const KYC_UPLOAD_CONFIG = {
  maxBytes: 10 * 1024 * 1024,
  acceptedTypes: ["application/pdf", "image/jpeg", "image/png"],
  acceptedExtensions: "PDF, JPG, JPEG or PNG"
};
const KYC_DOCUMENT_REQUIREMENTS: Record<AccountType, string[]> = {
  individual: ["Identity document", "Proof of address if required"],
  company: ["Company registration document", "Representative identity document"]
};

const validRoutes = new Set([
  "home",
  "bullion",
  "product",
  "market",
  "buy-sell",
  "signup",
  "verification",
  "cart",
  "checkout",
  "order-success",
  "account",
  "account/orders",
  "order-detail",
  "invoice",
  "login",
  "forgot-password",
  "reset-password",
  "password-reset-success",
  "account-created",
  "verification-pending",
  "verification-approved",
  "verification-declined",
  "serial-verification",
  "certificate",
  "wholesale",
  "about",
  "contact",
  "faq",
  "terms",
  "privacy",
  "delivery-policy",
  "refund-policy",
  "bullion-trading-policy",
  "search",
  "no-results",
  "filter-empty",
  "out-of-stock",
  "coming-soon",
  "404",
  "error",
  "maintenance",
  "pricing-unavailable",
  "bank-transfer",
  "pickup-instructions",
  "delivery-status"
]);

const accountNavItems = [
  ["Overview", "account"],
  ["Orders", "account/orders"],
  ["Invoices", "invoice"],
  ["Verification", "verification"],
  ["Certificates", "certificate"],
  ["Profile", "account"]
] as const;

function href(route: string) {
  return route === "home" ? "/" : `/${route}`;
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function AccountNav({ active }: { active: string }) {
  return (
    <aside className="account-nav">
      {accountNavItems.map(([label, route]) => (
        <Link key={`${label}-${route}`} href={href(route)} className={route === active ? "active" : undefined}>
          {label}
        </Link>
      ))}
    </aside>
  );
}

function AccountShell({ active, className, children }: { active: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cx("dashboard account-shell", className)}>
      <AccountNav active={active} />
      <div className="dashboard-main account-main">{children}</div>
    </section>
  );
}

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage?.getItem(key) ?? memoryStore.get(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      const raw = memoryStore.get(key);
      if (raw) setValue(JSON.parse(raw) as T);
    }
  }, [key]);

  const setStoredValue = useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        const serialised = JSON.stringify(resolved);
        memoryStore.set(key, serialised);
        try {
          window.localStorage?.setItem(key, serialised);
        } catch {
          // Some embedded browser contexts disable localStorage. Keep the prototype usable in memory.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue] as const;
}

function PlaceholderImage({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cx("image-ph", className)} role="img" aria-label={`Future image placeholder for ${src}`}>
      <span>{src}</span>
    </div>
  );
}

function OptimisedImage({
  src,
  alt,
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  position
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  position?: string;
}) {
  return (
    <figure className={cx("real-image", className)}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={position ? `object-${position}` : undefined} />
    </figure>
  );
}

function ProductMedia({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (src.endsWith(".webp")) {
    return <OptimisedImage src={src} alt={alt} className={cx("product-media", className)} sizes="(max-width: 720px) 100vw, 25vw" />;
  }
  return <PlaceholderImage src={src} className={className} />;
}

function hasPublishedProductImage(product: BullionProduct) {
  return product.image.startsWith("/images/products/") && product.image.endsWith(".webp");
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "gold" | "red" | "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function PrimaryButton({
  children,
  href: to,
  onClick,
  disabled,
  variant = "primary",
  type = "button"
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const className = cx("btn", variant, disabled && "disabled");
  if (to && !disabled) {
    return (
      <Link className={className} href={href(to)}>
        {children}
      </Link>
    );
  }
  return (
    <button className={className} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
}

function LivePriceStrip({
  market,
  currency,
  onCurrency
}: {
  market: typeof marketSnapshot;
  currency: "AUD" | "USD";
  onCurrency: (currency: "AUD" | "USD") => void;
}) {
  return (
    <section className="price-strip" aria-label="Live gold price">
      <div className="ticker-label">
        <strong>Gold Spot</strong>
      </div>
      <div className="ticker-price">
        <button className={currency === "AUD" ? "active" : ""} onClick={() => onCurrency("AUD")}>
          AUD
        </button>
        <span>{formatAUD(market.audPerOz)} / oz</span>
      </div>
      <div className="ticker-price">
        <button className={currency === "USD" ? "active" : ""} onClick={() => onCurrency("USD")}>
          USD
        </button>
        <span>{formatUSD(market.usdPerOz)} / oz</span>
      </div>
      <div className="ticker-change" aria-label="Market movement">
        ▲ +0.32%
      </div>
      <div className="ticker-meta">
        Updated {market.lastUpdated} · 5 min refresh
      </div>
      <Link className="ticker-link" href="/market">
        View live pricing →
      </Link>
    </section>
  );
}

function Header({
  cartCount,
  verification,
  market,
  currency,
  onCurrency,
  activeRoute
}: {
  cartCount: number;
  verification: VerificationState;
  market: typeof marketSnapshot;
  currency: "AUD" | "USD";
  onCurrency: (currency: "AUD" | "USD") => void;
  activeRoute: string;
}) {
  const [open, setOpen] = useState(false);
  const nav = [
    ["Bullion", "bullion"],
    ["Wholesale", "wholesale"],
    ["About", "about"]
  ];
  const actions = [
    ["Live Gold", "market"],
    ["Enquire", "contact"],
    [verification === "logged-out" ? "Sign In" : "Account", verification === "logged-out" ? "login" : "account"]
  ];
  const isActiveNav = (route: string) => activeRoute === route || (route === "bullion" && ["buy-sell", "product"].includes(activeRoute));
  return (
    <header className="site-header">
      <div className="topbar">
        <Link className="brand" href="/">
          <span className="brand-logo">
            <Image src="/images/home/brand-logo-full.png" alt="Iconic Bullion" fill sizes="240px" priority />
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary">
          {nav.map(([label, route]) => (
            <Link key={route} href={href(route)} className={isActiveNav(route) ? "active" : undefined} aria-current={isActiveNav(route) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <nav className="desktop-actions" aria-label="Actions">
          {actions.map(([label, route]) => (
            <Link key={route} href={href(route)} className={route === "market" ? "live-gold-link" : undefined}>
              {label}
            </Link>
          ))}
          <Link className="cart-link" href="/cart" aria-label={`Cart with ${cartCount} items`}>
            <ShoppingBag size={18} />
            <span>{cartCount}</span>
          </Link>
        </nav>
        <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>
      <LivePriceStrip market={market} currency={currency} onCurrency={onCurrency} />
      {open && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <button className="icon-button close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
          {[...nav, ...actions, ["Cart", "cart"], ["Serial Verification", "serial-verification"]].map(([label, route]) => (
            <Link key={route} href={href(route)} onClick={() => setOpen(false)} className={isActiveNav(route) ? "active" : undefined} aria-current={isActiveNav(route) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

function Footer() {
  const groups = [
    {
      title: "Bullion",
      links: [
        ["Shop Bullion", "bullion"],
        ["Live Gold Price", "market"],
        ["Buy / Sell Pricing", "buy-sell"],
        ["Serial Verification", "serial-verification"]
      ]
    },
    {
      title: "Account",
      links: [
        ["Sign In", "login"],
        ["Create Account", "signup"],
        ["Verification", "verification"],
        ["Orders", "account/orders"]
      ]
    },
    {
      title: "Company",
      links: [
        ["About", "about"],
        ["Wholesale", "wholesale"],
        ["Enquire", "contact"],
        ["FAQ", "faq"]
      ]
    },
    {
      title: "Legal",
      links: [
        ["Terms", "terms"],
        ["Privacy", "privacy"],
        ["Bullion Trading & KYC", "bullion-trading-policy"]
      ]
    }
  ];
  return (
    <footer className="footer">
      <div className="footer-brand">
        <span className="footer-logo">
          <Image src="/images/home/brand-logo-full.png" alt="Iconic Bullion" fill sizes="260px" />
        </span>
        <p>Premium Australian bullion with transparent live pricing and secure verification.</p>
      </div>
      <div className="footer-groups">
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <span>{group.title}</span>
            {group.links.map(([label, route]) => (
              <Link key={route} href={href(route)}>
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
    </footer>
  );
}

function ProductCard({
  product,
  onAdd,
  verification,
  compact,
  showcase = false,
  displayPrice,
  market = marketSnapshot
}: {
  product: BullionProduct;
  onAdd: (product: BullionProduct) => void;
  verification: VerificationState;
  compact?: boolean;
  showcase?: boolean;
  displayPrice?: string;
  market?: typeof marketSnapshot;
}) {
  const price = calculateProductBullionPrice(product, market);
  const disabled = product.availability === "Out of Stock" || product.availability === "Coming Soon";
  return (
    <article className={cx("product-card", compact && "compact", showcase && "showcase")}>
      <Link href={`/product?id=${product.id}`} aria-label={`View ${product.brand} ${product.name}`}>
        <ProductMedia src={product.image} alt={`${product.brand} ${product.name}`} />
      </Link>
      <div className="product-copy">
        {showcase && <span className="live-price-label">Live Price</span>}
        <span className="eyebrow">{product.brand}</span>
        <h3>{product.name}</h3>
        <p>
          {product.weightLabel} · {product.purity}
        </p>
        {!showcase && <span className="live-price-label">Live Price</span>}
        {product.iconicSerialEligible && !showcase && <span className="serial-note">Serial verification</span>}
        <div className="price-row">
          <strong>{displayPrice || formatAUD(price)}</strong>
          <StatusPill tone={product.availability === "In Stock" ? "green" : product.availability === "Low Stock" ? "gold" : "neutral"}>
            {product.availability}
          </StatusPill>
        </div>
      </div>
      <div className="card-actions">
        <PrimaryButton href={`product?id=${product.id}`} variant="secondary">
          View Product
        </PrimaryButton>
        {!showcase && (
          <PrimaryButton onClick={() => onAdd(product)} disabled={disabled} variant={verification === "approved" ? "primary" : "secondary"}>
            {verification === "approved" ? "Add" : "Verify"}
          </PrimaryButton>
        )}
      </div>
    </article>
  );
}

function VerificationGate({ onApprove }: { onApprove: () => void }) {
  return (
    <section className="gate">
      <ShieldCheck size={30} />
      <div>
        <h2>Verification Required</h2>
        <p>To purchase bullion, please complete identity verification first. This prototype simulates a GreenID-style review and does not connect to a live verification provider.</p>
      </div>
      <div className="split-actions">
        <PrimaryButton href="verification">Complete Verification</PrimaryButton>
        <PrimaryButton onClick={onApprove} variant="secondary">
          Demo: Approve Account
        </PrimaryButton>
      </div>
    </section>
  );
}

function CertificatePanel({ printable = false }: { printable?: boolean }) {
  const cert = serialRegistry["IB-10G-000219"];
  return (
    <section className={cx("certificate", printable && "printable")}>
      <div className="cert-head">
        <span className="brand-mark">IB</span>
        <div>
          <span className="eyebrow">Certificate of Authenticity</span>
          <h1>Iconic Bullion</h1>
        </div>
      </div>
      <div className="cert-grid">
        <Info label="Product" value={cert.product} />
        <Info label="Weight" value={cert.weight} />
        <Info label="Purity" value={cert.purity} />
        <Info label="Serial" value={cert.serial} />
        <Info label="Status" value={cert.status} />
        <Info label="Issue Date" value={cert.issueDate} />
      </div>
      <div className="barcode-box" aria-label="QR and barcode placeholder">
        <Barcode size={64} />
        <span>QR / barcode placeholder</span>
      </div>
      <div className="split-actions no-print">
        <button className="btn primary" onClick={() => window.print()}>
          <Printer size={17} /> Print Certificate
        </button>
        <button className="btn secondary">
          <Download size={17} /> Download PDF
        </button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MarketChart({ points, currency }: { points: HistoricalGoldPoint[]; currency: "AUD" | "USD" }) {
  const [activeIndex, setActiveIndex] = useState(points.length - 1);
  const values = points.map((point) => (currency === "AUD" ? point.audPrice : point.usdPrice));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const coords = points.map((point, index) => {
    const value = currency === "AUD" ? point.audPrice : point.usdPrice;
    const x = (index / Math.max(points.length - 1, 1)) * 100;
    const y = 90 - ((value - min) / span) * 76;
    return { point, value, x, y };
  });
  const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const active = coords[activeIndex] || coords.at(-1)!;
  const format = currency === "AUD" ? formatAUD : formatUSD;

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <div className="chart-wrap" onPointerMove={updateFromPointer} onPointerDown={updateFromPointer}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Historical gold price chart in ${currency}`}>
        {[18, 36, 54, 72].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={line} fill="none" className="chart-line" vectorEffect="non-scaling-stroke" />
        <line x1={active.x} x2={active.x} y1="10" y2="92" className="chart-cursor" vectorEffect="non-scaling-stroke" />
        <circle cx={active.x} cy={active.y} r="1.6" className="chart-dot" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-axis">
        <span>{format(max)}</span>
        <span>{format(min)}</span>
      </div>
      <div className="chart-tooltip" style={{ left: `${active.x}%`, top: `${active.y}%` }}>
        <strong>{format(active.value)} / oz</strong>
        <span>{active.point.label} · {active.point.time}</span>
      </div>
    </div>
  );
}

function FAQAccordion() {
  const faqs = [
    ["Account & Verification", "A verified Iconic Bullion account is required before purchasing bullion."],
    ["Buying Bullion", "Prices are calculated from the mock live gold price plus product-specific margin."],
    ["Live Pricing", "Prototype prices refresh on a simulated five-minute cycle."],
    ["Price Lock", "Cart prices lock for ten minutes while checkout is completed."],
    ["Payment & Invoicing", "Orders use bank transfer only. The invoice provides payment reference information."],
    ["Pickup & Delivery", "Store pickup is free. Insured delivery is represented by a mock configurable fee."],
    ["Returns & Cancellations", "Current bullion rules indicate no cancellation or refund, subject to final legal wording."],
    ["Serial Verification", "Public serial verification is for Iconic-branded bullion only."],
    ["Wholesale", "Wholesale enquiries are available for trade and business customers."]
  ];
  return (
    <div className="accordion">
      {faqs.map(([title, body]) => (
        <details key={title}>
          <summary>
            {title}
            <ChevronDown size={18} />
          </summary>
          <p>{body}</p>
        </details>
      ))}
    </div>
  );
}

export function IconicPrototype({ route }: { route: string }) {
  const normalRoute = validRoutes.has(route) ? route : "404";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verification, setVerification] = useStoredState<VerificationState>("ib-verification", "logged-out");
  const [accountType, setAccountType] = useStoredState<AccountType>("ib-account-type", "individual");
  const [cart, setCart] = useStoredState<CartLine[]>("ib-cart", []);
  const [fulfilment, setFulfilment] = useStoredState<Fulfilment>("ib-fulfilment", "pickup");
  const [orderPlaced, setOrderPlaced] = useStoredState("ib-order-placed", false);
  const [currency, setCurrency] = useState<"AUD" | "USD">("AUD");
  const [market, setMarket] = useState(marketSnapshot);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("All");
  const [productType, setProductType] = useState("All");
  const [weight, setWeight] = useState("All");
  const [availability, setAvailability] = useState("All");
  const [sort, setSort] = useState("Featured");
  const [serial, setSerial] = useState("IB-10G-000219");
  const [secondsLeft, setSecondsLeft] = useState(600);

  useEffect(() => {
    const priceInterval = window.setInterval(() => {
      setMarket((current) => ({
        ...current,
        audPerOz: Math.round((current.audPerOz + (Math.random() * 18 - 8)) * 100) / 100,
        usdPerOz: Math.round((current.usdPerOz + (Math.random() * 8 - 4)) * 100) / 100,
        lastUpdated: new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
      }));
    }, 300000);
    return () => window.clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setSecondsLeft(600);
      return;
    }
    const tick = window.setInterval(() => {
      const oldest = Math.min(...cart.map((line) => line.lockedAt));
      const elapsed = Math.floor((Date.now() - oldest) / 1000);
      const remaining = Math.max(600 - elapsed, 0);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setCart((lines) =>
          lines.map((line) => {
            const product = products.find((item) => item.id === line.productId)!;
            return { ...line, lockedPrice: calculateProductBullionPrice(product, market), lockedAt: Date.now() };
          })
        );
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [cart, market, setCart]);

  const cartLines = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter(Boolean) as Array<CartLine & { product: BullionProduct }>;
  const deliveryFee = fulfilment === "delivery" ? 35 : 0;
  const totals = calculateCartLockedPrice(cartLines, deliveryFee);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedProduct = useMemo(() => {
    const id = searchParams.get("id");
    return products.find((product) => product.id === id) || products[0];
  }, [normalRoute, searchParams]);

  const filteredProducts = useMemo(() => {
    const lower = query.toLowerCase();
    let result = products.filter((product) => {
      const brandMatch = brand === "All" || product.brand === brand;
      const typeMatch = productType === "All" || product.type === productType;
      const weightMatch = weight === "All" || product.weightLabel === weight;
      const availabilityMatch = availability === "All" || product.availability === availability;
      const queryMatch = !query || `${product.brand} ${product.name} ${product.weightLabel}`.toLowerCase().includes(lower);
      return hasPublishedProductImage(product) && brandMatch && typeMatch && weightMatch && availabilityMatch && queryMatch;
    });
    if (sort === "Featured") {
      result = result.sort((a, b) => {
        const featured = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featured) return featured;
        const iconic = Number(b.brand === "Iconic Bullion") - Number(a.brand === "Iconic Bullion");
        if (iconic) return iconic;
        return a.weightGrams - b.weightGrams;
      });
    }
    if (sort === "Price Low to High") result = result.sort((a, b) => calculateProductBullionPrice(a, market) - calculateProductBullionPrice(b, market));
    if (sort === "Price High to Low") result = result.sort((a, b) => calculateProductBullionPrice(b, market) - calculateProductBullionPrice(a, market));
    if (sort === "Weight Low to High") result = result.sort((a, b) => a.weightGrams - b.weightGrams);
    if (sort === "Weight High to Low") result = result.sort((a, b) => b.weightGrams - a.weightGrams);
    return result;
  }, [availability, brand, market, productType, query, sort, weight]);

  function addToCart(product: BullionProduct, quantity = 1) {
    if (verification !== "approved") {
      setVerification(verification === "logged-out" ? "unverified" : verification);
      router.push(href("verification"));
      return;
    }
    setCart((lines) => {
      const existing = lines.find((line) => line.productId === product.id);
      if (existing) return lines.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + quantity } : line));
      return [...lines, { productId: product.id, quantity, lockedPrice: calculateProductBullionPrice(product, market), lockedAt: Date.now() }];
    });
    router.push(href("cart"));
  }

  function placeOrder() {
    setOrderPlaced(true);
    router.push(href("order-success"));
  }

  function approveDemo() {
    setVerification("approved");
  }

  const page = (() => {
    switch (normalRoute) {
      case "home":
        return <Home onAdd={addToCart} verification={verification} />;
      case "bullion":
        return (
          <Listing
            products={filteredProducts}
            query={query}
            setQuery={setQuery}
            brand={brand}
            setBrand={setBrand}
            productType={productType}
            setProductType={setProductType}
            weight={weight}
            setWeight={setWeight}
            availability={availability}
            setAvailability={setAvailability}
            sort={sort}
            setSort={setSort}
            market={market}
            onAdd={addToCart}
            verification={verification}
          />
        );
      case "product":
        return <ProductDetail product={selectedProduct} market={market} verification={verification} onAdd={addToCart} />;
      case "market":
        return <MarketPage market={market} currency={currency} setCurrency={setCurrency} onAdd={addToCart} verification={verification} />;
      case "buy-sell":
        return <BuySellPage market={market} />;
      case "signup":
        return <SignupPage accountType={accountType} setAccountType={setAccountType} setVerification={setVerification} />;
      case "verification":
        return <VerificationPage accountType={accountType} verification={verification} setVerification={setVerification} />;
      case "cart":
        return <CartPage lines={cartLines} totals={totals} secondsLeft={secondsLeft} setCart={setCart} verification={verification} fulfilment={fulfilment} setFulfilment={setFulfilment} />;
      case "checkout":
        return (
          <CheckoutPage
            lines={cartLines}
            totals={totals}
            secondsLeft={secondsLeft}
            fulfilment={fulfilment}
            setFulfilment={setFulfilment}
            placeOrder={placeOrder}
            verification={verification}
          />
        );
      case "order-success":
        return <OrderSuccessPage orderPlaced={orderPlaced} totals={totals} />;
      case "account":
        return <Dashboard verification={verification} setVerification={setVerification} />;
      case "account/orders":
        return <OrderHistory />;
      case "order-detail":
        return <OrderDetail />;
      case "invoice":
        return <InvoicePage lines={cartLines} totals={totals} fulfilment={fulfilment} />;
      case "login":
        return <LoginPage setVerification={setVerification} />;
      case "forgot-password":
        return <ForgotPasswordPage />;
      case "reset-password":
        return <ResetPasswordPage />;
      case "password-reset-success":
        return <AuthSuccessPage title="Password updated" text="Your prototype password has been updated. You can now sign in to continue managing orders, invoices and verification." action="Return to Sign In" next="login" />;
      case "account-created":
        return <AuthSuccessPage title="Account created" text="Your Iconic Bullion account is ready. The next step is account verification before bullion purchasing is enabled." action="Start Verification" next="verification" />;
      case "verification-pending":
        return <VerificationStatusPage tone="pending" setVerification={setVerification} />;
      case "verification-approved":
        return <VerificationStatusPage tone="approved" setVerification={setVerification} />;
      case "verification-declined":
        return <VerificationStatusPage tone="declined" setVerification={setVerification} />;
      case "serial-verification":
        return <SerialPage serial={serial} setSerial={setSerial} />;
      case "certificate":
        return (
          <AccountShell active="certificate" className="certificate-account">
            <CertificatePanel printable />
          </AccountShell>
        );
      case "wholesale":
        return <WholesalePage />;
      case "about":
        return <AboutPage />;
      case "contact":
        return <ContactPage />;
      case "faq":
        return <FAQPage />;
      case "terms":
      case "privacy":
      case "delivery-policy":
      case "refund-policy":
      case "bullion-trading-policy":
        return <PolicyPage route={normalRoute} />;
      case "search":
        return <SearchPage query={query} setQuery={setQuery} products={filteredProducts} onAdd={addToCart} verification={verification} />;
      case "no-results":
        return <StatePage kind="no-results" />;
      case "filter-empty":
        return <StatePage kind="filter-empty" />;
      case "out-of-stock":
        return <ProductDetail product={products.find((p) => p.id === "cast-1kg")!} market={market} verification={verification} onAdd={addToCart} />;
      case "coming-soon":
        return <StatePage kind="coming-soon" />;
      case "error":
      case "maintenance":
      case "pricing-unavailable":
      case "404":
        return <StatePage kind={normalRoute} />;
      case "bank-transfer":
        return <InstructionPage kind="bank" totals={totals} />;
      case "pickup-instructions":
        return <InstructionPage kind="pickup" totals={totals} />;
      case "delivery-status":
        return <InstructionPage kind="delivery" totals={totals} />;
      default:
        return <StatePage kind="404" />;
    }
  })();

  return (
    <>
      <Header cartCount={cartCount} verification={verification} market={market} currency={currency} onCurrency={setCurrency} activeRoute={normalRoute} />
      <main>{page}</main>
      <Footer />
    </>
  );
}

function Home({ onAdd, verification }: { onAdd: (product: BullionProduct) => void; verification: VerificationState }) {
  const featuredProducts = products.filter((p) => p.featured).slice(0, 4);
  const featuredPrices: Record<string, string> = {
    "iconic-1g": "AUD $385.00",
    "iconic-5g": "AUD $1,185.00",
    "iconic-10g": "AUD $2,340.00",
    "premium-1g": "AUD $385.00"
  };
  const sizeLabels = ["1g", "2.5g", "5g", "10g", "20g", "1oz", "50g", "100g", "250g", "500g", "1kg"];
  const pricingSteps = [
    ["Live Gold Market", "Spot price, refreshed every 5 min"],
    ["Product Margin", "Format, weight and premium applied"],
    ["Your Live Price", "Transparent, in real time"]
  ];
  const trustItems = [
    ["Identity verification before trading", "Customer verification before bullion transactions."],
    ["Authenticity verification", "Selected Iconic Bullion bars include unique serial identification."],
    ["Secure customer account", "Your account, order history and invoices in one place."],
    ["Transparent order records", "Clear invoices and order records for every transaction."]
  ];
  const whyItems = [
    ["Live Pricing", "Prices linked to current bullion market movements, refreshed every 5 minutes."],
    ["Secure Verification", "Customer verification before trading. Authenticity controls for selected Iconic bullion."],
    ["Bank Transfer", "Clear invoice-based settlement. No payment surcharge on bank transfer."],
    ["Pickup or Delivery", "Free store pickup or fully insured secure delivery for eligible orders."]
  ];

  return (
    <>
      <section className="figma-hero">
        <div className="hero-copy">
          <span className="eyebrow gold">Australian Precious Metals</span>
          <h1>
            Gold.
            <br />
            <em>Refined.</em>
          </h1>
          <p>Buy investment-grade gold bullion with transparent live pricing, secure verification and flexible pickup or insured delivery.</p>
          <div className="split-actions">
            <PrimaryButton href="bullion">Shop Bullion</PrimaryButton>
            <PrimaryButton href="market" variant="secondary">
              View Live Gold Price
            </PrimaryButton>
          </div>
          <div className="trust-line">
            <span>Live pricing</span>
            <span>Secure verification</span>
            <span>Bank transfer</span>
          </div>
        </div>
        <OptimisedImage
          src="/images/home/bullion-hero.webp"
          alt="Premium gold bullion bars arranged on a luxury stone surface"
          className="hero-image"
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
          position="right"
        />
      </section>
      <section className="section category-section">
        <SectionHead title="Explore Bullion" subtitle="Investment-grade gold across a range of formats and weights." action={<Link href="/bullion">View all</Link>} />
        <div className="category-grid">
          <CategoryCard
            image="/images/home/minted-bars.webp"
            alt="Minted gold bars and assay packaging on a luxury stone surface"
            title="Minted Bars"
            body="Precision-finished investment gold"
            to="bullion?type=minted"
          />
          <CategoryCard
            image="/images/home/cast-bars.webp"
            alt="Cast gold bullion bars in multiple weights on a premium stone surface"
            title="Cast Bars"
            body="Traditional bullion with substantial weight"
            to="bullion?type=cast"
          />
          <CategoryCard
            image="/images/home/branded-bullion.webp"
            alt="Premium branded gold bullion bars displayed with green presentation packaging"
            title="Branded Bullion"
            body="Recognised premium bullion products"
            to="bullion?type=branded"
          />
        </div>
      </section>
      <section className="section featured-section">
        <SectionHead title="Featured Bullion" subtitle="Live-priced gold bars." action={<Link href="/bullion">View all bullion</Link>} />
        <div className="product-grid figma-products">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={onAdd} verification={verification} showcase displayPrice={featuredPrices[product.id]} />
          ))}
        </div>
      </section>
      <section className="split-section bar-size-section">
        <OptimisedImage src="/images/home/bar-sizes.webp" alt="Gold bar size range" className="bar-size-image" sizes="(max-width: 900px) 100vw, 48vw" />
        <div>
          <span className="eyebrow gold">Bullion for every strategy</span>
          <h2>Choose the weight that suits you.</h2>
          <p>From compact 1g minted bars through to substantial 1kg investment bars, explore bullion across a wide range of weights.</p>
          <div className="weight-list">
            {sizeLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <PrimaryButton href="bullion">Explore All Sizes</PrimaryButton>
        </div>
      </section>
      <section className="pricing-explainer">
        <div>
          <h2>Pricing that moves with the market.</h2>
          <p>Our bullion prices are linked directly to the live gold spot market, updated every 5 minutes.</p>
        </div>
        <div className="pricing-steps">
          {pricingSteps.map(([title, body], index) => (
            <article key={title}>
              <span>{title}</span>
              <p>{body}</p>
              {index < pricingSteps.length - 1 && <strong aria-hidden="true">→</strong>}
            </article>
          ))}
        </div>
        <div className="price-lock-callout">
          <span>When added to cart, your price is locked for:</span>
          <strong>
            <Clock size={15} /> PRICE LOCKED · 10:00
          </strong>
          <PrimaryButton href="market" variant="secondary">
            View Live Gold Price
          </PrimaryButton>
        </div>
      </section>
      <section className="split-section iconic-brand-section">
        <OptimisedImage src="/images/home/iconic-bullion-feature.webp" alt="Iconic Bullion gold bar with serial verification presentation" className="own-brand-image" sizes="(max-width: 900px) 100vw, 48vw" />
        <div>
          <span className="eyebrow gold">Iconic Bullion</span>
          <h2>Bullion you can verify.</h2>
          <p>Selected Iconic Bullion bars feature unique serial identification and certificate-ready authenticity verification.</p>
          <ul className="check-list">
            {["999.9 Fine Gold", "Unique serial identification", "Barcode / serial verification", "Printable authenticity certificate"].map((item) => (
              <li key={item}>
                <Check size={14} /> {item}
              </li>
            ))}
          </ul>
          <div className="split-actions">
            <PrimaryButton href="bullion?brand=Iconic%20Bullion">Explore Iconic Bullion</PrimaryButton>
            <PrimaryButton href="serial-verification" variant="secondary">
              Verify Serial
            </PrimaryButton>
          </div>
        </div>
      </section>
      <section className="trust-section">
        <div className="trust-grid">
          <div>
            <h2>Confidence in every bar.</h2>
            <p>Iconic Bullion combines account verification, transparent pricing and authenticity controls to create a secure bullion purchasing experience.</p>
          </div>
          <div>
            {trustItems.map(([title, body]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
        <OptimisedImage src="/images/home/verification-trust.webp" alt="Gold bullion bar displayed with authenticity certificate" className="trust-image" sizes="(max-width: 900px) 100vw, 90vw" />
      </section>
      <section className="delivery-section">
        <SectionHead eyebrow="Fulfilment" title="Receive your bullion your way." />
        <div className="delivery-grid">
          <OptimisedImage src="/images/home/secure-delivery.webp" alt="Gold bullion prepared in secure premium packaging" className="delivery-image" sizes="(max-width: 900px) 100vw, 58vw" />
          <div>
            <article>
              <PackageCheck />
              <h3>Store Pickup</h3>
              <p>Collect your bullion directly after payment confirmation.</p>
              <strong>Free</strong>
            </article>
            <article>
              <ShieldCheck />
              <h3>Insured Delivery</h3>
              <p>Secure delivery options for eligible orders, with discreet packaging and insurance represented in checkout.</p>
              <strong>Calculated after shipping configuration</strong>
            </article>
          </div>
        </div>
      </section>
      <section className="wholesale-band">
        <div>
          <span className="eyebrow gold">Wholesale Bullion</span>
          <h2>Bullion supply for professional buyers.</h2>
          <p>Speak with Iconic Bullion about wholesale availability, trade quantities and business requirements.</p>
          <PrimaryButton href="wholesale" variant="secondary">
            Wholesale Enquiry
          </PrimaryButton>
        </div>
        <OptimisedImage src="/images/home/wholesale.webp" alt="Multiple gold bullion bars prepared for wholesale supply" className="wholesale-image" sizes="(max-width: 900px) 100vw, 48vw" />
      </section>
      <section className="why-section">
        <h2>Why Iconic Bullion</h2>
        <div>
          {whyItems.map(([title, body]) => (
            <article key={title}>
              <span />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <NewsletterStrip />
    </>
  );
}

function NewsletterStrip() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  return (
    <section className="newsletter-strip">
      <div>
        <h2>Stay informed on gold.</h2>
        <p>Market updates, new products and bullion news from Iconic Bullion.</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setStatus(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "success" : "error");
        }}
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input id="newsletter-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" />
        <button type="submit">Subscribe</button>
        {status === "success" && <p role="status">Thanks. You are on the prototype update list.</p>}
        {status === "error" && <p role="alert">Enter a valid email address.</p>}
      </form>
    </section>
  );
}

function SectionHead({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function CategoryCard({ image, alt, title, body, to }: { image: string; alt: string; title: string; body: string; to: string }) {
  return (
    <Link href={href(to)} className="category-card">
      <OptimisedImage src={image} alt={alt} sizes="(max-width: 900px) 100vw, 33vw" />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </Link>
  );
}

function MiniCard({ image, imageAlt, title, body }: { image: string; imageAlt?: string; title: string; body: string }) {
  return (
    <article className="mini-card">
      {image.endsWith(".webp") ? <OptimisedImage src={image} alt={imageAlt || title} sizes="(max-width: 900px) 100vw, 33vw" /> : <PlaceholderImage src={image} />}
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function Listing({
  products,
  query,
  setQuery,
  brand,
  setBrand,
  productType,
  setProductType,
  weight,
  setWeight,
  availability,
  setAvailability,
  sort,
  setSort,
  market,
  onAdd,
  verification
}: {
  products: BullionProduct[];
  query: string;
  setQuery: (query: string) => void;
  brand: string;
  setBrand: (brand: string) => void;
  productType: string;
  setProductType: (type: string) => void;
  weight: string;
  setWeight: (weight: string) => void;
  availability: string;
  setAvailability: (availability: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  market: typeof marketSnapshot;
  onAdd: (product: BullionProduct) => void;
  verification: VerificationState;
}) {
  const brandOptions = ["All", "Iconic Bullion", "Aurelia Reserve", "PAMP Suisse", "Emirates Gold", "Generic", "ABC / Placeholder Brand"];
  const weightOptions = ["All", "1g", "2.5g", "5g", "10g", "20g", "1oz / 31.1g", "50g", "100g", "250g", "500g", "1kg"];

  return (
    <section className="page-shell">
      <SectionHead
        eyebrow="Investment Gold"
        title="Bullion"
        subtitle="Explore investment-grade gold bars across trusted brands, formats and weights, with pricing linked to the live gold market."
      />
      <div className="listing-categories">
        <CategoryCard image="/images/home/minted-bars.webp" alt="Iconic Bullion minted gold bars" title="Minted Bars" body="Refined presentation bars." to="bullion" />
        <CategoryCard image="/images/home/cast-bars.webp" alt="Iconic Bullion cast gold bars" title="Cast Bars" body="Substantial investment weights." to="bullion" />
        <CategoryCard image="/images/home/branded-bullion.webp" alt="Iconic Bullion branded bullion products" title="Branded Bullion" body="Own-brand and trusted products." to="bullion" />
      </div>
      <div className="catalogue">
        <aside className="filters">
          <h2>
            <Filter size={18} /> Filters
          </h2>
          <label>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bullion products" />
          </label>
          <label>
            Brand
            <select value={brand} onChange={(event) => setBrand(event.target.value)}>
              {brandOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={productType} onChange={(event) => setProductType(event.target.value)}>
              <option>All</option>
              <option>Minted Bars</option>
              <option>Cast Bars</option>
            </select>
          </label>
          <label>
            Weight
            <select value={weight} onChange={(event) => setWeight(event.target.value)}>
              {weightOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
              {["All", "In Stock", "Low Stock", "Out of Stock", "Coming Soon"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <PrimaryButton
            variant="ghost"
            onClick={() => {
              setQuery("");
              setBrand("All");
              setProductType("All");
              setWeight("All");
              setAvailability("All");
            }}
          >
            Reset Filters
          </PrimaryButton>
        </aside>
        <div>
          <div className="toolbar">
            <span>{products.length} bullion products</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
              {["Featured", "Price Low to High", "Price High to Low", "Weight Low to High", "Weight High to Low"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
          {products.length ? (
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} market={market} onAdd={onAdd} verification={verification} />
              ))}
            </div>
          ) : (
            <StatePage kind="filter-empty" embedded />
          )}
        </div>
      </div>
    </section>
  );
}

type ProductGalleryItem = {
  src: string;
  label: string;
  alt: string;
  fit?: "contain" | "cover";
};

function getProductGallery(product: BullionProduct): ProductGalleryItem[] {
  if (product.id === "iconic-10g") {
    return [
      {
        src: "/images/products/iconic-10g.webp",
        label: "Front",
        alt: "Front view of Iconic Bullion 10 gram minted gold bar"
      },
      {
        src: "/images/products/iconic-10g-back.webp",
        label: "Back",
        alt: "Reverse view of Iconic Bullion 10 gram minted gold bar"
      },
      {
        src: "/images/products/iconic-10g-detail.webp",
        label: "Detail",
        alt: "Close-up engraving and 999.9 purity view of Iconic Bullion 10 gram gold bar",
        fit: "cover"
      },
      {
        src: "/images/products/iconic-10g-packaging.webp",
        label: "Packaging",
        alt: "Iconic Bullion 10 gram bar in sealed assay-card packaging"
      },
      {
        src: "/images/products/iconic-10g-serial.webp",
        label: "Serial",
        alt: "Serial number and barcode verification close-up on Iconic Bullion 10 gram bar",
        fit: "cover"
      },
      {
        src: "/images/products/iconic-10g-certificate.webp",
        label: "Certificate",
        alt: "Certificate of Authenticity preview for Iconic Bullion 10 gram gold bar",
        fit: "cover"
      },
      {
        src: "/images/products/iconic-10g-dimensions.webp",
        label: "Dimensions",
        alt: "Dimensions reference view of Iconic Bullion 10 gram gold bar",
        fit: "cover"
      }
    ];
  }

  return product.gallery.map((src, index) => ({
    src,
    label: index === 0 ? "Front" : `View ${index + 1}`,
    alt: `${product.brand} ${product.name} product image`
  }));
}

function ProductDetail({
  product,
  market,
  verification,
  onAdd
}: {
  product: BullionProduct;
  market: typeof marketSnapshot;
  verification: VerificationState;
  onAdd: (product: BullionProduct, quantity?: number) => void;
}) {
  const gallery = getProductGallery(product);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const active = gallery[activeIndex] || gallery[0];
  const price = calculateProductBullionPrice(product, market);
  const unavailable = product.availability === "Out of Stock" || product.availability === "Coming Soon";
  const maxQuantity = Math.max(product.stock || 1, 1);
  const related = products
    .filter((item) => item.id !== product.id && item.brand === product.brand)
    .sort((a, b) => a.weightGrams - b.weightGrams)
    .slice(0, 4);
  const ctaLabel = verification === "approved" ? "Add to Cart" : verification === "logged-out" ? "Sign In to Purchase" : "Verify to Purchase";

  return (
    <section className="page-shell product-detail-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/bullion">Bullion</Link>
        <span>/</span>
        <span>{product.brand} {product.name}</span>
      </nav>
      <div className="product-detail">
        <div className="gallery detail-gallery">
          <OptimisedImage src={active.src} alt={active.alt} className={cx("main-product-image", active.fit === "cover" && "image-cover")} priority sizes="(max-width: 900px) 100vw, 58vw" />
          <div className="thumbs detail-thumbs" role="list" aria-label="Product gallery">
            {gallery.map((item, index) => (
              <button key={item.src} className={index === activeIndex ? "active" : ""} onClick={() => setActiveIndex(index)} aria-label={`Show ${item.label.toLowerCase()} image`}>
                <OptimisedImage src={item.src} alt={item.alt} sizes="120px" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{product.brand}</span>
          <h1>{product.name}</h1>
          <p>{product.purity} · {product.type}</p>
          <div className="quote-box live-price-box">
            <span>Live Price</span>
            <strong>{formatAUD(price)}</strong>
            <small>Prices refresh approximately every 5 minutes. Your live bullion price is locked for 10 minutes after adding the product to your cart.</small>
          </div>
          <div className="spec-grid">
            <Info label="Weight" value={product.weightLabel} />
            <Info label="Stock" value={product.stock || "Unavailable"} />
            <Info label="Availability" value={product.availability} />
            <Info label="Updated" value={market.lastUpdated} />
          </div>
          {product.iconicSerialEligible && <StatusPill tone="gold">Serial verification available</StatusPill>}
          <div className="quantity-row" aria-label="Quantity selector">
            <button onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1}>-</button>
            <strong>{quantity}</strong>
            <button onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))} disabled={quantity >= maxQuantity}>+</button>
          </div>
          {verification !== "approved" && (
            <section className="detail-gate">
              <span className="eyebrow">Verification required</span>
              <p>To purchase bullion, please complete your identity verification first.</p>
              <PrimaryButton href={verification === "logged-out" ? "login" : "verification"} variant="secondary">
                {verification === "logged-out" ? "Sign In" : "Complete Verification"}
              </PrimaryButton>
            </section>
          )}
          <div className="split-actions">
            <PrimaryButton onClick={() => onAdd(product, quantity)} disabled={unavailable || verification !== "approved"} variant="primary">
              {unavailable ? product.availability : ctaLabel}
            </PrimaryButton>
            <PrimaryButton href="contact" variant="ghost">
              Enquire
            </PrimaryButton>
          </div>
          <p className="policy-note">
            Bullion orders are subject to our <Link href="/refund-policy">refund and cancellation policy</Link>.
          </p>
        </div>
      </div>

      <section className="detail-section detail-highlights">
        <SectionHead eyebrow="Highlights" title="Investment-grade details" />
        <div>
          {[
            product.purity,
            `${product.weightLabel} investment-grade bullion`,
            `${product.brand} own-brand presentation`,
            product.iconicSerialEligible ? "Serial verification available" : "Certificate-ready authenticity",
            "Secure pickup or insured delivery"
          ].map((item) => (
            <article key={item}>{item}</article>
          ))}
        </div>
      </section>

      <section className="detail-section detail-specifications">
        <SectionHead eyebrow="Specifications" title="Product information" />
        <div className="spec-grid">
          <Info label="Brand" value={product.brand} />
          <Info label="Product" value={product.name} />
          <Info label="Weight" value={product.weightLabel} />
          <Info label="Purity" value={product.purity.replace(" Fine Gold", "")} />
          <Info label="Type" value={product.type.replace(" Bars", "")} />
          <Info label="Material" value="Gold" />
          <Info label="Serial Verification" value={product.iconicSerialEligible ? "Available" : "Not available"} />
          <Info label="Packaging" value={product.id === "iconic-10g" ? "Assay-style sealed packaging" : "Product packaging varies by brand"} />
          <Info label="Dimensions" value="Final product dimensions to be confirmed." />
        </div>
      </section>

      {product.id === "iconic-10g" && (
        <>
          <section className="detail-feature">
            <OptimisedImage src="/images/products/iconic-10g-serial.webp" alt="Serial number and barcode detail on Iconic Bullion 10 gram bar" sizes="(max-width: 900px) 100vw, 50vw" />
            <div>
              <span className="eyebrow">Serial Verification</span>
              <h2>Verify your Iconic Bullion bar</h2>
              <p>Selected Iconic Bullion bars include unique serial identification that can be checked through the website.</p>
              <PrimaryButton href="serial-verification" variant="secondary">Verify Serial</PrimaryButton>
            </div>
          </section>

          <section className="detail-feature reverse">
            <OptimisedImage src="/images/products/iconic-10g-certificate.webp" alt="Certificate of authenticity preview for Iconic Bullion 10 gram gold bar" sizes="(max-width: 900px) 100vw, 50vw" />
            <div>
              <span className="eyebrow">Authenticity</span>
              <h2>Certificate of Authenticity</h2>
              <p>Verified Iconic Bullion products can display a product-specific authenticity certificate associated with the serial number.</p>
              <PrimaryButton href="certificate" variant="secondary">View Sample Certificate</PrimaryButton>
            </div>
          </section>
        </>
      )}

      <section className="detail-section fulfilment-strip">
        <SectionHead eyebrow="Fulfilment" title="Receive your bullion your way" />
        <div className="spec-grid">
          <Info label="Store Pickup" value="Free" />
          <Info label="Insured Delivery" value="Fee calculated separately" />
          <Info label="Payment Method" value="Bank Transfer" />
        </div>
      </section>

      <section className="detail-section">
        <SectionHead eyebrow="Related Products" title="Explore nearby weights" />
        <div className="product-grid">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} market={market} onAdd={onAdd} verification={verification} />
          ))}
        </div>
      </section>
    </section>
  );
}

function MarketPage({
  market,
  currency,
  setCurrency,
  onAdd,
  verification
}: {
  market: typeof marketSnapshot;
  currency: "AUD" | "USD";
  setCurrency: (currency: "AUD" | "USD") => void;
  onAdd: (product: BullionProduct) => void;
  verification: VerificationState;
}) {
  const [range, setRange] = useState<MarketRange>("1M");
  const [pricingStatus, setPricingStatus] = useState<"available" | "unavailable">("available");
  const [historyStatus, setHistoryStatus] = useState<"available" | "unavailable">("available");
  const marketStats = marketPriceService.getCurrentGoldPrice(market);
  const chartPoints = marketPriceService.getHistoricalGoldPrices(range);
  const currentPrice = currency === "AUD" ? marketStats.currentAud : marketStats.currentUsd;
  const change = currency === "AUD" ? marketStats.changeAud : marketStats.changeUsd;
  const format = currency === "AUD" ? formatAUD : formatUSD;
  const exchangeRate = marketStats.currentUsd / marketStats.currentAud;
  const dayHigh = currency === "AUD" ? marketStats.dayHighAud : marketStats.dayHighAud * exchangeRate;
  const dayLow = currency === "AUD" ? marketStats.dayLowAud : marketStats.dayLowAud * exchangeRate;
  const previousClose = currency === "AUD" ? marketStats.previousCloseAud : marketStats.previousCloseAud * exchangeRate;
  const pricePerGram = currency === "AUD" ? getGoldPricePerGram(market) : market.usdPerOz / TROY_OUNCE_GRAMS;
  const featured = products.filter((product) => product.featured && hasPublishedProductImage(product)).slice(0, 4);

  return (
    <section className="page-shell market-page">
      <section className="market-hero">
        <div>
          <span className="eyebrow gold">Live Gold Market</span>
          <h1>Live Gold Price</h1>
          <p>Track the current gold price in Australian and US dollars, explore historical movements, and view Iconic Bullion pricing linked to the market.</p>
          <p className="market-note">Market pricing refreshes approximately every five minutes.</p>
          <div className="segmented">
            <button className={currency === "AUD" ? "active" : ""} onClick={() => setCurrency("AUD")} aria-pressed={currency === "AUD"}>
              AUD
            </button>
            <button className={currency === "USD" ? "active" : ""} onClick={() => setCurrency("USD")} aria-pressed={currency === "USD"}>
              USD
            </button>
          </div>
        </div>
        <OptimisedImage
          src="/images/market/live-gold-hero.webp"
          alt="Investment-grade gold bullion representing the live gold market"
          className="market-hero-image"
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
          position="center"
        />
      </section>

      <section className="market-panel">
        {pricingStatus === "unavailable" ? (
          <div className="market-failure">
            <AlertTriangle size={22} />
            <div>
              <h2>Live pricing is temporarily unavailable.</h2>
              <p>We're unable to retrieve the latest market rate at this time.</p>
            </div>
            <div className="split-actions">
              <PrimaryButton onClick={() => setPricingStatus("available")}>Try Again</PrimaryButton>
              <PrimaryButton href="bullion" variant="secondary">Browse Bullion</PrimaryButton>
            </div>
          </div>
        ) : (
          <>
            <div className="market-price-head">
              <div>
                <span className="eyebrow">Gold Spot Price</span>
                <h2>{format(currentPrice)} / oz</h2>
                <p>
                  <span className="market-open">Live pricing</span> Updated {marketStats.lastUpdated} · approximately 5 min refresh
                </p>
              </div>
              <div className="segmented" aria-label="Currency">
                <button className={currency === "AUD" ? "active" : ""} onClick={() => setCurrency("AUD")} aria-pressed={currency === "AUD"}>
                  AUD
                </button>
                <button className={currency === "USD" ? "active" : ""} onClick={() => setCurrency("USD")} aria-pressed={currency === "USD"}>
                  USD
                </button>
              </div>
            </div>
            <div className="market-stat-grid">
              <Info label="Current Price" value={`${format(currentPrice)} / oz`} />
              <Info label="Change" value={`${change >= 0 ? "+" : ""}${format(change)}`} />
              <Info label="Change %" value={`${marketStats.changePercent >= 0 ? "+" : ""}${marketStats.changePercent.toFixed(2)}%`} />
              <Info label="Day High" value={format(dayHigh)} />
              <Info label="Day Low" value={format(dayLow)} />
              <Info label="Previous Close" value={format(previousClose)} />
              <Info label="Price / Gram" value={format(pricePerGram)} />
              <Info label="Last Updated" value={marketStats.lastUpdated} />
            </div>
          </>
        )}
      </section>

      <section className="panel market-chart-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Historical Gold Price</span>
            <h2>{currency} gold market movement</h2>
            <p>Prototype historical market data is provider-neutral and can be replaced by the final pricing source.</p>
          </div>
          <div className="periods" aria-label="Chart timeframe">
            {marketRanges.map((period) => (
              <button key={period} className={range === period ? "active" : ""} onClick={() => setRange(period)} aria-pressed={range === period}>
                {period}
              </button>
            ))}
          </div>
        </div>
        {historyStatus === "unavailable" ? (
          <div className="market-failure compact">
            <AlertTriangle size={20} />
            <p>Historical price data is temporarily unavailable.</p>
            <PrimaryButton onClick={() => setHistoryStatus("available")} variant="secondary">Try Again</PrimaryButton>
          </div>
        ) : (
          <MarketChart points={chartPoints} currency={currency} />
        )}
      </section>

      <section className="table-wrap market-history-table" aria-label="Historical gold prices">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>AUD / oz</th>
              <th>USD / oz</th>
              <th>Change</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {chartPoints.slice(-8).map((point, index, rows) => {
              const previous = rows[index - 1]?.audPrice ?? point.audPrice;
              const rowChange = point.audPrice - previous;
              return (
              <tr key={point.label}>
                <td>{point.label}</td>
                <td>{point.time}</td>
                <td>{formatAUD(point.audPrice)}</td>
                <td>{formatUSD(point.usdPrice)}</td>
                <td>{index === 0 ? "—" : `${rowChange >= 0 ? "+" : ""}${formatAUD(rowChange)}`}</td>
                <td>{currency}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="detail-feature market-trust-section">
        <OptimisedImage
          src="/images/market/market-trust.webp"
          alt="Investment-grade gold bullion arranged for professional precious-metals trading"
          sizes="(max-width: 900px) 100vw, 50vw"
        />
        <div>
          <span className="eyebrow gold">Market Trust</span>
          <h2>Market-linked. Physical bullion.</h2>
          <p>Iconic Bullion pricing is designed around the prevailing gold market rate, with product-specific pricing applied transparently to each bullion product.</p>
          <div className="market-point-list">
            {[
              ["Market-linked pricing", "Bullion prices move with the underlying gold market."],
              ["5-minute refresh", "Displayed bullion prices update approximately every five minutes."],
              ["Product-specific pricing", "Each bullion product may carry its own pricing adjustment."],
              ["10-minute cart lock", "Once added to cart, the displayed bullion price is temporarily locked for 10 minutes."]
            ].map(([title, body]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-explainer market-pricing-flow">
        <div>
          <h2>How bullion pricing works.</h2>
          <p>Spot gold is the underlying market reference. Bullion product prices are market-linked selling prices for finished products.</p>
        </div>
        <div className="pricing-steps">
          {[
            ["Live Gold Market", "Underlying gold market reference"],
            ["Product-Specific Pricing", "Format, weight and product pricing applied"],
            ["Your Bullion Price", "Displayed customer price in AUD"]
          ].map(([title, body], index) => (
            <article key={title}>
              <span>{title}</span>
              <p>{body}</p>
              {index < 2 && <strong aria-hidden="true">→</strong>}
            </article>
          ))}
        </div>
        <PrimaryButton href="bullion">Shop Bullion</PrimaryButton>
      </section>

      <section className="market-cta-band">
        <div>
          <span className="eyebrow">Buy / Sell Pricing</span>
          <h2>Looking for current bullion buy and sell pricing?</h2>
        </div>
        <PrimaryButton href="buy-sell" variant="secondary">View Buy / Sell Prices</PrimaryButton>
      </section>

      <section className="detail-section">
        <SectionHead eyebrow="Market-linked Products" title="Shop at today's market-linked prices" />
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} market={market} onAdd={onAdd} verification={verification} />
          ))}
        </div>
      </section>
    </section>
  );
}

function BuySellPage({ market }: { market: typeof marketSnapshot }) {
  const [pricingBrand, setPricingBrand] = useState("All");
  const [pricingType, setPricingType] = useState("All");
  const [pricingWeight, setPricingWeight] = useState("All");
  const [pricingAvailability, setPricingAvailability] = useState("All");
  const [pricingSort, setPricingSort] = useState("Featured");
  const pricingProducts = useMemo(() => products.filter(hasPublishedProductImage), []);
  const brands = useMemo(() => ["All", ...Array.from(new Set(pricingProducts.map((product) => product.brand)))], [pricingProducts]);
  const types = useMemo(() => ["All", ...Array.from(new Set(pricingProducts.map((product) => product.type)))], [pricingProducts]);
  const weights = useMemo(() => ["All", ...Array.from(new Set(pricingProducts.map((product) => product.weightLabel)))], [pricingProducts]);
  const availabilities = useMemo(() => ["All", ...Array.from(new Set(pricingProducts.map((product) => product.availability)))], [pricingProducts]);
  const pricingRows = useMemo(() => {
    let result = pricingProducts.filter((product) => {
      const brandMatch = pricingBrand === "All" || product.brand === pricingBrand;
      const typeMatch = pricingType === "All" || product.type === pricingType;
      const weightMatch = pricingWeight === "All" || product.weightLabel === pricingWeight;
      const availabilityMatch = pricingAvailability === "All" || product.availability === pricingAvailability;
      return brandMatch && typeMatch && weightMatch && availabilityMatch;
    });
    result = [...result].sort((a, b) => {
      if (pricingSort === "Price Low to High") return calculateProductBullionPrice(a, market) - calculateProductBullionPrice(b, market);
      if (pricingSort === "Price High to Low") return calculateProductBullionPrice(b, market) - calculateProductBullionPrice(a, market);
      if (pricingSort === "Weight Low to High") return a.weightGrams - b.weightGrams;
      if (pricingSort === "Weight High to Low") return b.weightGrams - a.weightGrams;
      const featured = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featured) return featured;
      return a.weightGrams - b.weightGrams;
    });
    return result.slice(0, 12);
  }, [market, pricingAvailability, pricingBrand, pricingProducts, pricingSort, pricingType, pricingWeight]);
  const featuredPricingProducts = pricingRows.slice(0, 4);

  return (
    <section className="buy-sell-page">
      <section className="buy-sell-hero">
        <div className="buy-sell-hero-copy">
          <span className="eyebrow">Buy / Sell Pricing</span>
          <h1>Current bullion buy &amp; sell pricing</h1>
          <p>View current product selling prices and indicative buy-back pricing across selected bullion products.</p>
          <p>Pricing is linked to the prevailing gold market and updated regularly.</p>
          <div className="split-actions">
            <a className="btn primary" href="#pricing-table">
              View Pricing
            </a>
            <PrimaryButton href="bullion" variant="secondary">
              Shop Bullion
            </PrimaryButton>
          </div>
        </div>
        <OptimisedImage
          src="/images/pricing/buy-sell-hero.webp"
          alt="Gold bullion bars representing current buy and sell pricing"
          className="buy-sell-hero-image"
          priority
          sizes="(max-width: 900px) 100vw, 56vw"
        />
      </section>
      <section className="pricing-table-section" id="pricing-table">
        <div className="pricing-table-head">
          <div>
            <span className="eyebrow">Current Product Pricing</span>
            <h2>Buy price vs sell-back price</h2>
            <p>
              Buy price is the customer purchase price. Sell-back price is the indicative price Iconic Bullion may pay to buy bullion back, subject to inspection and final confirmation.
            </p>
          </div>
          <p className="pricing-updated">Last updated: {market.lastUpdated} · 5 min refresh</p>
        </div>
        <div className="pricing-filter-bar" aria-label="Pricing filters">
          <label>
            Brand
            <select value={pricingBrand} onChange={(event) => setPricingBrand(event.target.value)}>
              {brands.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={pricingType} onChange={(event) => setPricingType(event.target.value)}>
              {types.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Weight
            <select value={pricingWeight} onChange={(event) => setPricingWeight(event.target.value)}>
              {weights.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select value={pricingAvailability} onChange={(event) => setPricingAvailability(event.target.value)}>
              {availabilities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={pricingSort} onChange={(event) => setPricingSort(event.target.value)}>
              {["Featured", "Price Low to High", "Price High to Low", "Weight Low to High", "Weight High to Low"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap pricing-table-wrap">
          <table className="buy-sell-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Weight</th>
                <th>Buy Price</th>
                <th>Sell-Back Price</th>
              <th>Availability</th>
              <th>Last Updated</th>
                <th>Action</th>
            </tr>
          </thead>
          <tbody>
              {pricingRows.map((product) => (
              <tr key={product.id}>
                  <td data-label="Product">
                    <Link className="pricing-product-cell" href={`/product?id=${product.id}`}>
                      <OptimisedImage src={product.image} alt={product.name} className="pricing-product-thumb" sizes="64px" />
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.purity}</small>
                      </span>
                    </Link>
                  </td>
                  <td data-label="Brand">{product.brand}</td>
                  <td data-label="Weight">{product.weightLabel}</td>
                  <td data-label="Buy Price" className="price-cell">{formatAUD(calculateProductBullionPrice(product, market))}</td>
                  <td data-label="Sell-Back Price" className="price-cell sellback">{formatAUD(calculateBuyBackPrice(product, market))}</td>
                  <td data-label="Availability">
                    <StatusPill tone={product.availability === "In Stock" ? "green" : product.availability === "Out of Stock" ? "red" : "gold"}>{product.availability}</StatusPill>
                  </td>
                  <td data-label="Last Updated">{market.lastUpdated}</td>
                  <td data-label="Action">
                    <Link className="table-action" href={`/product?id=${product.id}`}>
                      View Product
                    </Link>
                  </td>
              </tr>
            ))}
              {pricingRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="pricing-empty">
                    No products match the selected pricing filters.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
      </section>
      <section className="pricing-explanation">
        <div>
          <span className="eyebrow">How Pricing Works</span>
          <h2>Spot, product price and sell-back pricing are different references.</h2>
          <p>Bullion product prices are linked to the underlying gold market, with product-specific pricing applied to each item. Buy-back pricing is indicative and subject to inspection, verification and final confirmation.</p>
        </div>
        <div className="pricing-points">
          {[
            ["Spot Gold Price", "Market reference price for gold."],
            ["Product Buy Price", "Retail product selling price, including product-specific adjustments."],
            ["Sell-Back Price", "Indicative repurchase price, subject to physical review."],
            ["Updated Regularly", `Aligned with the shared market refresh. Last updated ${market.lastUpdated}.`]
          ].map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="sell-to-iconic">
        <OptimisedImage src="/images/pricing/bullion-inspection.webp" alt="Professional inspection of bullion for sell-back pricing" className="sell-to-iconic-image" sizes="(max-width: 900px) 100vw, 48vw" />
        <div>
          <span className="eyebrow">Sell bullion to Iconic</span>
          <h2>Inspection before final buy-back</h2>
          <p>Customers can view indicative buy-back pricing online, but final sell-back transactions are reviewed and completed through the appropriate in-store process, including product inspection and verification.</p>
          <p className="pricing-note">Buy-back prices shown online are indicative only and may be subject to physical inspection and final confirmation.</p>
          <PrimaryButton href="contact">Make a Buy-Back Enquiry</PrimaryButton>
        </div>
      </section>
      {featuredPricingProducts.length > 0 && (
        <section className="pricing-quick-links">
          <div>
            <span className="eyebrow">Popular Bullion Products</span>
            <h2>Continue into selected bullion products.</h2>
          </div>
          <div>
            {featuredPricingProducts.map((product) => (
              <Link key={product.id} href={`/product?id=${product.id}`}>
                <OptimisedImage src={product.image} alt={product.name} className="pricing-quick-image" sizes="72px" />
                <span>
                  <strong>{product.name}</strong>
                  <small>{formatAUD(calculateProductBullionPrice(product, market))}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function SignupPage({
  accountType,
  setAccountType,
  setVerification
}: {
  accountType: AccountType;
  setAccountType: (type: AccountType) => void;
  setVerification: (state: VerificationState) => void;
}) {
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "", mobile: "", company: "", abn: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const activeType = selectedType ?? accountType;
  const isCompany = activeType === "company";

  function chooseType(type: AccountType) {
    setAccountType(type);
    setSelectedType(type);
    setErrors({});
  }

  function updateField(field: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fields.name.trim()) nextErrors.name = isCompany ? "Authorised representative name is required." : "Full legal name is required.";
    if (isCompany && !fields.company.trim()) nextErrors.company = "Registered company name is required.";
    if (isCompany && !fields.abn.trim()) nextErrors.abn = "ABN or ACN is required.";
    if (!isValidEmail(fields.email)) nextErrors.email = "Please enter a valid email address.";
    if (!fields.mobile.trim()) nextErrors.mobile = "Mobile number is required.";
    if (fields.password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setVerification("unverified");
    window.location.href = href("account-created");
  }

  return (
    <AuthLayout
      eyebrow="Create Account"
      title={selectedType ? (isCompany ? "Australian company account" : "Individual account") : "Create your account"}
      text={selectedType ? "Set up secure account access first. Identity and company verification happens after account creation." : "Choose the account type that matches how you intend to trade physical bullion."}
    >
      {!selectedType ? (
        <div className="auth-card">
          <div className="account-type-grid">
            <button className={accountType === "individual" ? "selected" : ""} onClick={() => chooseType("individual")}>
              <UserRound size={22} />
              <strong>Individual</strong>
              <span>Personal bullion purchasing with identity verification after account creation.</span>
            </button>
            <button className={accountType === "company" ? "selected" : ""} onClick={() => chooseType("company")}>
              <BriefcaseBusiness size={22} />
              <strong>Australian Company</strong>
              <span>Business account access before ABN / ACN and representative verification.</span>
            </button>
          </div>
          <p className="auth-note">Verification is completed in the dedicated account verification flow after this step.</p>
        </div>
      ) : (
        <form className="auth-card auth-form" onSubmit={submitSignup} noValidate>
          {isCompany && (
            <AuthField label="Registered company name" error={errors.company}>
              <input value={fields.company} onChange={(event) => updateField("company", event.target.value)} placeholder="Iconic Trading Pty Ltd" />
            </AuthField>
          )}
          <AuthField label={isCompany ? "Authorised representative" : "Full legal name"} error={errors.name}>
            <input value={fields.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Avery Morgan" />
          </AuthField>
          {isCompany && (
            <AuthField label="ABN / ACN" error={errors.abn}>
              <input value={fields.abn} onChange={(event) => updateField("abn", event.target.value)} placeholder="12 345 678 901" />
            </AuthField>
          )}
          <AuthField label="Email" error={errors.email}>
            <input type="email" value={fields.email} onChange={(event) => updateField("email", event.target.value)} placeholder="customer@example.com" />
          </AuthField>
          <AuthField label="Mobile" error={errors.mobile}>
            <input value={fields.mobile} onChange={(event) => updateField("mobile", event.target.value)} placeholder="+61 400 000 000" />
          </AuthField>
          <AuthField label="Password" error={errors.password}>
            <PasswordInput value={fields.password} onChange={(value) => updateField("password", value)} show={showPassword} setShow={setShowPassword} />
          </AuthField>
          <PrimaryButton type="submit">Create Account</PrimaryButton>
          <div className="auth-links">
            <button type="button" onClick={() => setSelectedType(null)}>Change Account Type</button>
            <Link href="/login">Already have an account?</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function VerificationPage({
  accountType,
  verification,
  setVerification
}: {
  accountType: AccountType;
  verification: VerificationState;
  setVerification: (state: VerificationState) => void;
}) {
  const [step, setStep] = useState<KycStep>("overview");
  const [documents, setDocuments] = useState<KycDocumentMeta[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isCompany = accountType === "company";
  const documentRequirements = KYC_DOCUMENT_REQUIREMENTS[accountType];
  const progress: Array<{ id: KycStep; label: string }> = [
    { id: "details", label: "Details" },
    { id: "documents", label: "Documents" },
    { id: "review", label: "Review" },
    { id: "overview", label: "Status" }
  ];
  const activeProgress = step === "overview" ? 0 : progress.findIndex((item) => item.id === step);
  const statusLabel = verification === "approved" ? "Approved" : verification === "pending" ? "Under Review" : verification === "declined" ? "Action Required" : "Not Started";
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

  function handleUpload(label: string, fileList: FileList | null) {
    setUploadError("");
    const file = fileList?.[0];
    if (!file) return;
    if (!KYC_UPLOAD_CONFIG.acceptedTypes.includes(file.type)) {
      setUploadError(`Unsupported file type. Upload ${KYC_UPLOAD_CONFIG.acceptedExtensions}.`);
      return;
    }
    if (file.size > KYC_UPLOAD_CONFIG.maxBytes) {
      setUploadError("File exceeds the maximum allowed size.");
      return;
    }
    setDocuments((current) => [
      ...current.filter((document) => document.label !== label),
      { id: `${label}-${file.name}`, label, name: file.name, size: file.size, status: "uploaded" }
    ]);
  }

  function submitVerification() {
    if (!accepted || submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setVerification("pending");
      window.location.href = href("verification-pending");
    }, 450);
  }

  return (
    <AccountShell active="verification" className="verification-account">
    <section className="kyc-page">
      <div className="kyc-hero">
        <div className="kyc-hero-copy">
          <span className="eyebrow">Verification</span>
          <h1>Complete your verification</h1>
          <p>Verification is required before bullion purchasing is enabled. This prototype keeps the provider integration neutral and represents a manual review workflow.</p>
          <div className="kyc-status-strip">
            <Info label="Account Type" value={isCompany ? "Australian Company" : "Individual"} />
            <Info label="Current Status" value={statusLabel} />
          </div>
          <div className="split-actions">
            <PrimaryButton onClick={() => setStep(verification === "pending" ? "review" : "details")}>
              {documents.length || verification !== "unverified" ? "Continue Verification" : "Start Verification"}
            </PrimaryButton>
            <PrimaryButton href="account" variant="secondary">Back to Account</PrimaryButton>
          </div>
        </div>
        <OptimisedImage src="/images/kyc/verification-hero.webp" alt="Iconic Bullion account verification cards with gold bar" className="kyc-hero-image" priority sizes="(max-width: 900px) 100vw, 46vw" />
      </div>

      <div className="kyc-progress" aria-label="Verification progress">
        {progress.map((item, index) => (
          <button key={item.label} className={cx(index <= activeProgress && "active", step === item.id && "current")} onClick={() => setStep(item.id === "overview" ? "review" : item.id)}>
            <span>{index + 1}</span>
            {item.label}
          </button>
        ))}
      </div>

      {step === "details" && (
        <div className="kyc-workspace">
          <div className="kyc-panel">
            <span className="eyebrow">{isCompany ? "Company details" : "Personal details"}</span>
            <h2>{isCompany ? "Australian company verification" : "Individual verification"}</h2>
            <div className="form-card two-col kyc-form">
              {isCompany ? (
                <>
                  <label>Company Name<input defaultValue="Iconic Trading Pty Ltd" /></label>
                  <label>ABN / ACN<input defaultValue="12 345 678 901" /></label>
                  <label className="wide">Registered Address<input defaultValue="Level 4, 100 Collins Street" /></label>
                  <label className="wide">Trading Address if different<input placeholder="Leave blank if same as registered address" /></label>
                  <label>Representative First Name<input defaultValue="Avery" /></label>
                  <label>Representative Last Name<input defaultValue="Morgan" /></label>
                  <label>Role / Position<input defaultValue="Director" /></label>
                  <label>Email<input type="email" defaultValue="avery@example.com" /></label>
                  <label>Mobile<input defaultValue="+61 400 000 000" /></label>
                </>
              ) : (
                <>
                  <label>First Name<input defaultValue="Avery" /></label>
                  <label>Last Name<input defaultValue="Morgan" /></label>
                  <label>Date of Birth<input type="date" /></label>
                  <label>Mobile<input defaultValue="+61 400 000 000" /></label>
                  <label>Email<input type="email" defaultValue="avery@example.com" /></label>
                  <label className="wide">Residential Address<input defaultValue="Level 4, 100 Collins Street" /></label>
                  <label>Suburb<input defaultValue="Melbourne" /></label>
                  <label>State<input defaultValue="VIC" /></label>
                  <label>Postcode<input defaultValue="3000" /></label>
                  <label>Country<input defaultValue="Australia" /></label>
                </>
              )}
            </div>
            <div className="split-actions">
              <PrimaryButton onClick={() => setStep("documents")}>Continue to Documents</PrimaryButton>
            </div>
          </div>
          <div className="kyc-help-card">
            <ShieldCheck />
            <h3>Secure manual review</h3>
            <p>Details collected here are prototype fields only. A production provider can be connected without changing the customer-facing steps.</p>
          </div>
        </div>
      )}

      {step === "documents" && (
        <div className="kyc-documents">
          <OptimisedImage src="/images/kyc/document-upload.webp" alt="Secure document upload visual for Iconic Bullion verification" className="kyc-documents-image" sizes="(max-width: 900px) 100vw, 42vw" />
          <div className="kyc-panel">
            <span className="eyebrow">Secure documents</span>
            <h2>Upload verification documents</h2>
            <p>Upload the required documents securely to continue your account verification.</p>
            <div className="upload-list">
              {documentRequirements.map((label) => {
                const uploaded = documents.find((document) => document.label === label);
                return (
                  <label key={label} className={cx("upload-drop", uploaded && "uploaded")}>
                    <UploadCloud size={22} />
                    <span>
                      <strong>{label}</strong>
                      <small>{uploaded ? `${uploaded.name} · ${(uploaded.size / 1024 / 1024).toFixed(1)} MB` : `${KYC_UPLOAD_CONFIG.acceptedExtensions} · max 10 MB`}</small>
                    </span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => handleUpload(label, event.target.files)} />
                  </label>
                );
              })}
            </div>
            {uploadError && <p className="field-error">{uploadError}</p>}
            {documents.length > 0 && (
              <div className="document-row uploaded-document">
                <FileText size={18} />
                <span>{documents.length} document metadata record{documents.length > 1 ? "s" : ""} ready for review</span>
                <button type="button" onClick={() => setDocuments([])}><X size={16} /> Remove</button>
              </div>
            )}
            <div className="split-actions">
              <PrimaryButton onClick={() => setStep("review")}>Review Submission</PrimaryButton>
              <PrimaryButton onClick={() => setStep("details")} variant="secondary">Back</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="kyc-workspace">
          <div className="kyc-panel">
            <span className="eyebrow">Review & Submit</span>
            <h2>Review your verification details</h2>
            <div className="review-grid">
              <Info label="Account Type" value={isCompany ? "Australian Company" : "Individual"} />
              <Info label="Submission Date" value={today} />
              <Info label={isCompany ? "Company" : "Customer"} value={isCompany ? "Iconic Trading Pty Ltd" : "Avery Morgan"} />
              <Info label="Documents" value={documents.length ? `${documents.length} uploaded` : "Awaiting upload"} />
            </div>
            <div className="document-summary">
              {documentRequirements.map((label) => {
                const uploaded = documents.find((document) => document.label === label);
                return (
                  <div key={label}>
                    <FileText size={18} />
                    <span>
                      <strong>{label}</strong>
                      <small>{uploaded ? uploaded.name : "Not uploaded in prototype session"}</small>
                    </span>
                    <button type="button" onClick={() => setStep("documents")}>Edit</button>
                  </div>
                );
              })}
            </div>
            <label className="checkbox declaration">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>I confirm that the information provided is accurate for this prototype submission.</span>
            </label>
            <div className="split-actions">
              <PrimaryButton onClick={submitVerification} disabled={!accepted || submitting}>{submitting ? "Submitting..." : "Submit for Verification"}</PrimaryButton>
              <PrimaryButton onClick={() => setStep("documents")} variant="secondary">Back to Documents</PrimaryButton>
            </div>
          </div>
          <div className="kyc-help-card">
            <Clock />
            <h3>Manual review workflow</h3>
            <p>Submitting moves the account to Under Review. Purchasing remains disabled through the existing verification gate until approved.</p>
          </div>
        </div>
      )}
    </section>
    </AccountShell>
  );
}

function CartPage({
  lines,
  totals,
  secondsLeft,
  setCart,
  verification,
  fulfilment,
  setFulfilment
}: {
  lines: Array<CartLine & { product: BullionProduct }>;
  totals: { subtotal: number; deliveryFee: number; total: number };
  secondsLeft: number;
  setCart: (lines: CartLine[]) => void;
  verification: VerificationState;
  fulfilment: Fulfilment;
  setFulfilment: (fulfilment: Fulfilment) => void;
}) {
  const verified = verification === "approved";
  const checkoutBlockedReason = !verified ? "Complete verification before checkout." : lines.some((line) => line.product.availability === "Out of Stock") ? "Remove out-of-stock items before checkout." : undefined;
  const updateQuantity = (line: CartLine & { product: BullionProduct }, nextQuantity: number) => {
    const quantity = Math.min(Math.max(nextQuantity, 1), Math.max(line.product.stock, 1));
    setCart(lines.map((item) => (item.productId === line.productId ? { ...item, quantity } : item)));
  };

  return (
    <section className="cart-page">
      <SectionHead eyebrow="Cart" title="Locked bullion pricing" subtitle="Eligible bullion prices are locked for 10 minutes once added to cart." />
      {!verified && <VerificationGate onApprove={() => window.localStorage.setItem("ib-verification", JSON.stringify("approved"))} />}
      {lines.length === 0 ? (
        <section className="cart-empty-panel">
          <OptimisedImage
            src="/images/cart/price-lock-empty.webp"
            alt="Iconic Bullion gold bars representing secure locked bullion pricing"
            className="cart-empty-image"
            priority
            sizes="(max-width: 900px) 100vw, 62vw"
          />
          <div>
            <span className="eyebrow">Price Lock</span>
            <h2>Your cart is empty</h2>
            <p>Add verified bullion products to see the 10-minute price lock.</p>
            <p>Eligible bullion prices are locked for 10 minutes once added to cart.</p>
            <PrimaryButton href="bullion">Browse Bullion</PrimaryButton>
          </div>
        </section>
      ) : (
        <div className="cart-layout">
          <div className="line-list">
            {lines.map((line) => (
              <article className="cart-line" key={line.productId}>
                <ProductMedia src={line.product.image} alt={`${line.product.brand} ${line.product.name}`} className="cart-product-image" />
                <div className="cart-line-copy">
                  <span>{line.product.brand}</span>
                  <strong>
                    {line.product.name}
                  </strong>
                  <p>{line.product.weightLabel} · {line.product.purity}</p>
                  <StatusPill tone={line.product.availability === "In Stock" ? "green" : line.product.availability === "Out of Stock" ? "red" : "gold"}>{line.product.availability}</StatusPill>
                </div>
                <div className="quantity-stepper" aria-label={`Quantity for ${line.product.name}`}>
                  <button type="button" aria-label={`Decrease quantity for ${line.product.name}`} onClick={() => updateQuantity(line, line.quantity - 1)} disabled={line.quantity <= 1}>
                    -
                  </button>
                  <input
                    aria-label={`Quantity for ${line.product.name}`}
                    type="number"
                    min="1"
                    max={Math.max(line.product.stock, 1)}
                    value={line.quantity}
                    onChange={(event) => updateQuantity(line, Number(event.target.value) || 1)}
                  />
                  <button type="button" aria-label={`Increase quantity for ${line.product.name}`} onClick={() => updateQuantity(line, line.quantity + 1)} disabled={line.quantity >= line.product.stock}>
                    +
                  </button>
                </div>
                <div className="cart-line-price">
                  <span>Locked unit price</span>
                  <strong>{formatAUD(line.lockedPrice)}</strong>
                  <small>Line total {formatAUD(line.lockedPrice * line.quantity)}</small>
                  {line.quantity > line.product.stock && <small className="field-error">Only {line.product.stock} units are currently available.</small>}
                </div>
                <button className="remove-line" type="button" onClick={() => setCart(lines.filter((item) => item.productId !== line.productId))}>
                  Remove
                </button>
              </article>
            ))}
          </div>
          <Summary totals={totals} secondsLeft={secondsLeft} cta={checkoutBlockedReason ? "Verify to Continue" : "Proceed to Checkout"} to={checkoutBlockedReason ? undefined : "checkout"} fulfilment={fulfilment} setFulfilment={setFulfilment} blockedReason={checkoutBlockedReason} />
        </div>
      )}
    </section>
  );
}

function Summary({
  totals,
  secondsLeft,
  cta,
  to,
  fulfilment,
  setFulfilment,
  blockedReason
}: {
  totals: { subtotal: number; deliveryFee: number; total: number };
  secondsLeft: number;
  cta: string;
  to?: string;
  fulfilment?: Fulfilment;
  setFulfilment?: (fulfilment: Fulfilment) => void;
  blockedReason?: string;
}) {
  return (
    <aside className="summary">
      <span className="eyebrow">Price Locked</span>
      <strong className={cx("timer", secondsLeft < 90 && "urgent")}>{formatTimer(secondsLeft)}</strong>
      <p>{secondsLeft === 0 ? "Your price lock has expired. Prices have been refreshed using the latest market rate." : "Your bullion price is temporarily locked while you complete your order."}</p>
      {fulfilment && setFulfilment && (
        <div className="cart-fulfilment" role="radiogroup" aria-label="Fulfilment choice">
          <button type="button" className={fulfilment === "pickup" ? "selected" : ""} onClick={() => setFulfilment("pickup")} aria-pressed={fulfilment === "pickup"}>
            <PackageCheck size={18} />
            <span>Store Pickup</span>
            <small>Free</small>
          </button>
          <button type="button" className={fulfilment === "delivery" ? "selected" : ""} onClick={() => setFulfilment("delivery")} aria-pressed={fulfilment === "delivery"}>
            <Truck size={18} />
            <span>Insured Delivery</span>
            <small>AUD 35.00 mock fee</small>
          </button>
        </div>
      )}
      <Info label="Subtotal" value={formatAUD(totals.subtotal)} />
      <Info label="Delivery / insurance" value={totals.deliveryFee ? formatAUD(totals.deliveryFee) : "Free"} />
      <Info label="Grand total" value={formatAUD(totals.total)} />
      <div className="bank-box compact">
        <Banknote />
        <div>
          <strong>Payment Method: Bank Transfer</strong>
          <p>No card or wallet payment options are included.</p>
        </div>
      </div>
      {blockedReason && <p className="summary-blocked" role="status">{blockedReason}</p>}
      {to && <PrimaryButton href={to}>{cta}</PrimaryButton>}
      {!to && <button className="btn primary disabled" type="button" disabled>{cta}</button>}
    </aside>
  );
}

function CheckoutPage({
  lines,
  totals,
  secondsLeft,
  fulfilment,
  setFulfilment,
  placeOrder,
  verification
}: {
  lines: Array<CartLine & { product: BullionProduct }>;
  totals: { subtotal: number; deliveryFee: number; total: number };
  secondsLeft: number;
  fulfilment: Fulfilment;
  setFulfilment: (fulfilment: Fulfilment) => void;
  placeOrder: () => void;
  verification: VerificationState;
}) {
  const [ack, setAck] = useState(false);
  if (verification !== "approved") {
    return (
      <section className="page-shell">
        <VerificationGate onApprove={() => window.location.reload()} />
      </section>
    );
  }
  return (
    <section className="page-shell">
      <SectionHead eyebrow="Checkout" title="Review order and bank transfer details" />
      <div className="checkout-layout">
        <div className="form-card">
          <h2>Customer details</h2>
          <Info label="Verification" value={<StatusPill tone="green">Approved</StatusPill>} />
          <label>
            Contact name
            <input defaultValue="Avery Morgan" />
          </label>
          <label>
            Email
            <input defaultValue="customer@example.com" />
          </label>
          <h2>Fulfilment</h2>
          <div className="choice-grid small">
            <button className={fulfilment === "pickup" ? "selected" : ""} onClick={() => setFulfilment("pickup")}>
              <PackageCheck />
              <strong>Store Pickup</strong>
              <span>Free</span>
            </button>
            <button className={fulfilment === "delivery" ? "selected" : ""} onClick={() => setFulfilment("delivery")}>
              <Truck />
              <strong>Insured Delivery</strong>
              <span>AUD 35.00 mock fee</span>
            </button>
          </div>
          <h2>Bank transfer only</h2>
          <div className="bank-box">
            <Banknote />
            <div>
              <strong>Payment Method: Bank Transfer</strong>
              <p>Bank details are shown on the generated invoice. No card or wallet payment options are included.</p>
            </div>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />I acknowledge that bullion orders are subject to Iconic Bullion's cancellation and refund policy.
          </label>
          <PrimaryButton onClick={placeOrder} disabled={!ack || lines.length === 0}>
            Place Order
          </PrimaryButton>
        </div>
        <Summary totals={totals} secondsLeft={secondsLeft} cta="Place Order" />
      </div>
    </section>
  );
}

function OrderSuccessPage({ orderPlaced, totals }: { orderPlaced: boolean; totals: { total: number } }) {
  return (
    <section className="page-shell narrow">
      <div className="success-panel">
        <Check size={44} />
        <span className="eyebrow">Order successfully placed</span>
        <h1>Pending for Payment</h1>
        <div className="spec-grid">
          <Info label="Order #" value={orderPlaced ? "IB-10472" : "IB-DEMO"} />
          <Info label="Invoice #" value="INV-2026-0188" />
          <Info label="Total" value={formatAUD(totals.total || 2489.62)} />
          <Info label="Status" value="Pending for Payment" />
        </div>
        <ol className="next-steps">
          <li>Invoice generated</li>
          <li>Complete bank transfer externally</li>
          <li>Iconic confirms payment manually</li>
          <li>Order prepared for pickup or delivery</li>
        </ol>
        <div className="split-actions">
          <PrimaryButton href="invoice">View Invoice</PrimaryButton>
          <PrimaryButton href="order-detail" variant="secondary">
            View Order
          </PrimaryButton>
        </div>
      </div>
    </section>
  );
}

function Dashboard({ verification, setVerification }: { verification: VerificationState; setVerification: (state: VerificationState) => void }) {
  const verificationMeta = {
    approved: {
      tone: "green" as const,
      label: "Approved",
      body: "Your prototype account is verified for bullion purchasing.",
      action: "Browse Bullion",
      href: "bullion"
    },
    pending: {
      tone: "gold" as const,
      label: "Under Review",
      body: "Your verification has been submitted and is awaiting review.",
      action: "View Verification Status",
      href: "verification-pending"
    },
    declined: {
      tone: "red" as const,
      label: "Action Required",
      body: "Your verification requires an update before bullion purchasing is enabled.",
      action: "Update Verification",
      href: "verification"
    },
    unverified: {
      tone: "gold" as const,
      label: "Action Required",
      body: "Complete verification before purchasing bullion.",
      action: "Complete Verification",
      href: "verification"
    },
    "logged-out": {
      tone: "neutral" as const,
      label: "Sign In Required",
      body: "Sign in or create an account to manage verification and orders.",
      action: "Sign In",
      href: "login"
    }
  }[verification];
  return (
    <AccountShell active="account">
        <SectionHead eyebrow="Account" title="Welcome back" subtitle="Manage your verification, orders, invoices and bullion certificates." />
        <div className="dashboard-summary-grid">
          <article className="dashboard-summary-card">
            <span>Verification Status</span>
            <strong>{verificationMeta.label}</strong>
            <StatusPill tone={verificationMeta.tone}>{verificationMeta.label}</StatusPill>
          </article>
          <article className="dashboard-summary-card">
            <span>Recent Orders</span>
            <strong>{mockOrders.length}</strong>
            <small>Latest account activity</small>
          </article>
          <article className="dashboard-summary-card">
            <span>Invoices</span>
            <strong>{mockOrders.length}</strong>
            <small>Bank transfer records</small>
          </article>
          <article className="dashboard-summary-card">
            <span>Certificates</span>
            <strong>1</strong>
            <small>Linked bullion certificate</small>
          </article>
        </div>
        <section className="account-trust-card">
          <div>
            <span className="eyebrow">Account Trust</span>
            <h2>{verificationMeta.label}</h2>
            <p>{verificationMeta.body}</p>
            <div className="split-actions">
              <PrimaryButton href={verificationMeta.href}>{verificationMeta.action}</PrimaryButton>
              <PrimaryButton href="serial-verification" variant="ghost">
                Verify Serial
              </PrimaryButton>
            </div>
          </div>
          <OptimisedImage
            src="/images/dashboard/account-verification.webp"
            alt="Iconic Bullion account verification and trust confirmation"
            className="account-trust-image"
            priority
            sizes="(max-width: 900px) 100vw, 32vw"
          />
        </section>
        <div className="demo-controls" aria-label="Prototype verification controls">
          <span>Prototype controls</span>
          <button className="btn secondary" type="button" onClick={() => setVerification("approved")}>
            Demo: Approved
          </button>
          <button className="btn ghost" type="button" onClick={() => setVerification("pending")}>
            Demo: Pending
          </button>
        </div>
        <OrderHistory embedded />
        <section className="dashboard-certificate-card">
          <OptimisedImage src="/images/dashboard/certificate-preview.webp" alt="Gold bullion and certificate representing account certificate access" className="dashboard-certificate-image" sizes="(max-width: 900px) 100vw, 32vw" />
          <div>
            <span className="eyebrow">Your Certificates</span>
            <h2>Iconic Bullion 10g Minted Gold Bar</h2>
            <Info label="Serial" value="IB-10G-000219" />
            <Info label="Status" value={<StatusPill tone="green">Verified</StatusPill>} />
            <PrimaryButton href="certificate" variant="secondary">
              View Certificate
            </PrimaryButton>
          </div>
        </section>
        <section className="dashboard-quick-actions">
          <PrimaryButton href="bullion">Shop Bullion</PrimaryButton>
          <PrimaryButton href="account/orders" variant="secondary">
            View Orders
          </PrimaryButton>
          <PrimaryButton href="invoice" variant="ghost">
            View Invoices
          </PrimaryButton>
        </section>
    </AccountShell>
  );
}

function OrderHistory({ embedded }: { embedded?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const totalSpend = mockOrders.reduce((sum, order) => sum + order.amount, 0);
  const pendingOrders = mockOrders.filter((order) => order.payment.includes("Pending")).length;
  const filteredOrders = mockOrders.filter((order) => {
    const matchesQuery = [order.orderNo, order.invoiceNo, order.products, order.payment, order.fulfilment].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "pending" ? order.payment.includes("Pending") : order.payment === "Paid");
    return matchesQuery && matchesFilter;
  });
  const orderImage = (productsLabel: string) => (productsLabel.includes("PAMP") ? "/images/products/premium-1g.webp" : "/images/products/iconic-10g.webp");
  const content = (
    <>
      {!embedded && (
        <div className="orders-hero">
          <div>
            <span className="eyebrow">Orders</span>
            <h1>Order history</h1>
            <p>Track bullion orders, payment status, fulfilment progress and invoice records in one secure account view.</p>
          </div>
          <div className="orders-hero-actions">
            <PrimaryButton href="bullion">Shop Bullion</PrimaryButton>
            <PrimaryButton href="invoice" variant="secondary">Latest Invoice</PrimaryButton>
          </div>
        </div>
      )}
      <div className="orders-summary-grid">
        <article>
          <span>Total Orders</span>
          <strong>{mockOrders.length}</strong>
          <small>Across this account</small>
        </article>
        <article>
          <span>Total Value</span>
          <strong>{formatAUD(totalSpend)}</strong>
          <small>Prototype order value</small>
        </article>
        <article>
          <span>Pending Payment</span>
          <strong>{pendingOrders}</strong>
          <small>Awaiting bank transfer</small>
        </article>
      </div>
      <div className="orders-toolbar">
        <label className="orders-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders, invoices or products" />
        </label>
        <div className="orders-filters" aria-label="Order filters">
          {[
            ["all", "All"],
            ["pending", "Pending"],
            ["paid", "Paid"]
          ].map(([id, label]) => (
            <button key={id} className={filter === id ? "active" : ""} type="button" onClick={() => setFilter(id as typeof filter)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap orders-table-wrap">
        <table className="orders-table enhanced">
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Fulfilment</th>
              <th>Invoice</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.orderNo}>
                <td data-label="Order">
                  <Link href="/order-detail" className="order-number">{order.orderNo}</Link>
                  <small>{order.date}</small>
                </td>
                <td data-label="Product">
                  <div className="order-product">
                    <ProductMedia src={orderImage(order.products)} alt={order.products} className="order-product-image" />
                    <span>
                      <strong>{order.products}</strong>
                      <small>Physical gold bullion</small>
                    </span>
                  </div>
                </td>
                <td data-label="Amount" className="order-amount">{formatAUD(order.amount)}</td>
                <td data-label="Payment">
                  <StatusPill tone={order.payment.includes("Pending") ? "gold" : "green"}>{order.payment}</StatusPill>
                </td>
                <td data-label="Fulfilment">
                  <span className="fulfilment-chip">
                    {order.fulfilment === "Store Pickup" ? <PackageCheck size={16} /> : <Check size={16} />}
                    {order.fulfilment}
                  </span>
                </td>
                <td data-label="Invoice">
                  <Link href="/invoice" className="invoice-link">{order.invoiceNo}</Link>
                </td>
                <td data-label="Action">
                  <div className="order-actions">
                    <Link className="table-action" href="/order-detail">View Order</Link>
                    <Link className="invoice-download" href="/invoice" aria-label={`View invoice ${order.invoiceNo}`}>
                      <Download size={15} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <div className="orders-empty">
            <FileText />
            <strong>No matching orders</strong>
            <p>Adjust your search or filter to view your bullion order records.</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    embedded ? (
    <section className="panel order-history-panel">
      {embedded && (
        <div className="panel-head">
          <div>
            <span className="eyebrow">Orders</span>
            <h2>Recent orders</h2>
          </div>
          <Link href="/account/orders">View all orders →</Link>
        </div>
      )}
      <div>{content}</div>
    </section>
    ) : (
      <AccountShell active="account/orders" className="orders-page">
        <div className="orders-main">{content}</div>
      </AccountShell>
    )
  );
}

function OrderDetail() {
  const timeline = ["Order Placed", "Pending for Payment", "Payment Confirmed", "Processing", "Ready for Pickup / Shipped", "Completed"];
  return (
    <section className="page-shell">
      <SectionHead eyebrow="Track order" title="Order IB-10472" />
      <div className="timeline">
        {timeline.map((item, index) => (
          <div key={item} className={index < 2 ? "active" : ""}>
            <span>{index + 1}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>
      <div className="split-section">
        <div className="panel">
          <Info label="Market price at purchase" value={`${formatAUD(marketSnapshot.audPerOz)} / oz`} />
          <Info label="Fulfilment" value="Store Pickup" />
          <Info label="Invoice" value={<Link href="/invoice">INV-2026-0188</Link>} />
          <Info label="Certificate" value={<Link href="/certificate">IB-10G-000219</Link>} />
        </div>
        <PlaceholderImage src="/images/orders/order-success.jpg" />
      </div>
    </section>
  );
}

function InvoicePage({ lines, totals, fulfilment }: { lines: Array<CartLine & { product: BullionProduct }>; totals: { subtotal: number; deliveryFee: number; total: number }; fulfilment: Fulfilment }) {
  void lines;
  void totals;
  void fulfilment;
  const invoiceProduct = products.find((product) => product.id === "iconic-10g") ?? products[2];
  const invoiceLines = [{ product: invoiceProduct, quantity: 1, lockedPrice: calculateProductBullionPrice(invoiceProduct, marketSnapshot), productId: invoiceProduct.id, lockedAt: Date.now() }];
  const fallbackTotals = calculateCartLockedPrice(invoiceLines, 0);
  const invoiceStatus = "Pending for Payment";
  const invoiceMeta = [
    ["Order #", "IB-10472"],
    ["Issue Date", "18 September 2026"],
    ["Customer", "Avery Morgan"],
    ["Customer Code", "CUST-00492"]
  ];
  const paymentSteps = [
    "Use the reference IB-10472 with your transfer",
    "Funds are matched manually by Iconic Bullion",
    "Pickup details are released after payment clears"
  ];
  return (
    <AccountShell active="invoice" className="invoice-account">
    <section className="invoice-shell">
      <div className="invoice">
        <div className="invoice-head">
          <div>
            <span className="eyebrow">ICONIC BULLION</span>
            <h1>Invoice INV-2026-0188</h1>
            <p>Payment reference, locked price and fulfilment details for your bullion order.</p>
          </div>
          <div className="invoice-head-actions no-print">
            <StatusPill tone="gold">{invoiceStatus}</StatusPill>
            <button className="btn primary" onClick={() => window.print()}>
              <Printer size={17} /> Print
            </button>
            <button className="btn secondary">
              <Download size={17} /> Download
            </button>
          </div>
        </div>
        <div className="invoice-status-strip">
          <article>
            <Clock size={18} />
            <span>Payment Due</span>
            <strong>Bank transfer pending</strong>
          </article>
          <article>
            <ShieldCheck size={18} />
            <span>Price Lock</span>
            <strong>{formatAUD(fallbackTotals.total)}</strong>
          </article>
          <article>
            <PackageCheck size={18} />
            <span>Fulfilment</span>
            <strong>Store Pickup</strong>
          </article>
        </div>
        <div className="invoice-meta-grid">
          {invoiceMeta.map(([label, value]) => (
            <Info key={label} label={label} value={value} />
          ))}
        </div>
        <div className="invoice-body">
          <div className="invoice-line-items">
            <div className="invoice-section-head">
              <div>
                <span className="eyebrow">Locked Bullion</span>
                <h2>Order items</h2>
              </div>
              <Link href="/order-detail">View order</Link>
            </div>
            <div className="table-wrap invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Weight</th>
                    <th>Qty</th>
                    <th>Locked Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceLines.map((line) => (
                    <tr key={line.productId}>
                      <td data-label="Product">
                        <div className="invoice-product">
                          <ProductMedia src={line.product.image} alt={`${line.product.brand} ${line.product.name}`} className="invoice-product-image" />
                          <span>
                            <strong>{line.product.brand} {line.product.name}</strong>
                            <small>Physical gold bullion · 999.9</small>
                          </span>
                        </div>
                      </td>
                      <td data-label="Weight">{line.product.weightLabel}</td>
                      <td data-label="Qty">{line.quantity}</td>
                      <td data-label="Locked Price">{formatAUD(line.lockedPrice)}</td>
                      <td data-label="Total" className="invoice-line-total">{formatAUD(line.lockedPrice * line.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="invoice-note">
              <FileText size={18} />
              <p>This invoice records the locked bullion price at order creation. Bullion is released after payment is matched to the order reference.</p>
            </div>
          </div>
          <aside className="invoice-total">
            <div className="invoice-total-head">
              <span>Amount Due</span>
              <strong>{formatAUD(fallbackTotals.total)}</strong>
              <small>{invoiceStatus}</small>
            </div>
            <Info label="Market gold price" value={`${formatAUD(marketSnapshot.audPerOz)} AUD / oz · ${formatUSD(marketSnapshot.usdPerOz)} USD / oz`} />
            <Info label="Delivery / Insurance" value={fallbackTotals.deliveryFee ? formatAUD(fallbackTotals.deliveryFee) : "Free Store Pickup"} />
            <Info label="Payment Method" value="Bank Transfer" />
            <Info label="Bank Details" value="Placeholder BSB / Account / Reference IB-10472" />
            <div className="invoice-payment-steps">
              <span className="eyebrow">Next Steps</span>
              {paymentSteps.map((step) => (
                <p key={step}><Check size={15} /> {step}</p>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
    </AccountShell>
  );
}

function AuthLayout({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="auth-page">
      <div className="auth-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
      </div>
      <OptimisedImage src="/images/account/account-access.webp" alt="Iconic Bullion secure account access with gold bar and account ready card" className="auth-visual" priority sizes="(max-width: 900px) 100vw, 50vw" />
    </section>
  );
}

function AuthField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className={cx("auth-field", error && "has-error")}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function PasswordInput({ value, onChange, show, setShow, placeholder = "Enter password" }: { value: string; onChange: (value: string) => void; show: boolean; setShow: (show: boolean) => void; placeholder?: string }) {
  return (
    <span className="password-input">
      <input type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}

function LoginPage({ setVerification }: { setVerification: (state: VerificationState) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!isValidEmail(email)) nextErrors.email = "Please enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setVerification("unverified");
    window.location.href = href("account");
  }

  return (
    <AuthLayout eyebrow="Account" title="Sign in" text="Access your Iconic Bullion account to manage orders, invoices, verification and certificates.">
      <form className="auth-card auth-form" onSubmit={submitLogin} noValidate>
        <AuthField label="Email" error={errors.email}>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" />
        </AuthField>
        <AuthField label="Password" error={errors.password}>
          <PasswordInput value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} />
        </AuthField>
        <PrimaryButton type="submit">Sign In</PrimaryButton>
        <div className="auth-links">
          <Link href="/forgot-password">Forgot Password</Link>
          <Link href="/signup">Create Account</Link>
        </div>
        <p className="auth-note">Verification is required before bullion purchase.</p>
      </form>
    </AuthLayout>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    window.location.href = href("reset-password");
  }

  return (
    <AuthLayout eyebrow="Account" title="Reset your password" text="Enter the email linked to your Iconic Bullion account and continue to the secure reset step.">
      <form className="auth-card auth-form" onSubmit={submitForgot} noValidate>
        <AuthField label="Email" error={error}>
          <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="customer@example.com" />
        </AuthField>
        <PrimaryButton type="submit">Send Reset Link</PrimaryButton>
        <div className="auth-links">
          <Link href="/login">Return to Sign In</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (!confirmPassword) nextErrors.confirmPassword = "Please confirm your new password.";
    if (confirmPassword && password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    window.location.href = href("password-reset-success");
  }

  return (
    <AuthLayout eyebrow="Account" title="Choose a new password" text="Set a new password for secure account access.">
      <form className="auth-card auth-form" onSubmit={submitReset} noValidate>
        <AuthField label="New Password" error={errors.password}>
          <PasswordInput value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} placeholder="New password" />
        </AuthField>
        <AuthField label="Confirm Password" error={errors.confirmPassword}>
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} show={showConfirmPassword} setShow={setShowConfirmPassword} placeholder="Confirm password" />
        </AuthField>
        <PrimaryButton type="submit">Update Password</PrimaryButton>
      </form>
    </AuthLayout>
  );
}

function AuthSuccessPage({ title, text, action, next }: { title: string; text: string; action: string; next: string }) {
  return (
    <AuthLayout eyebrow="Account" title={title} text={text}>
      <div className="auth-card auth-success">
        <span>
          <Check size={24} />
        </span>
        <p>Secure access is ready. Verification status and trading permissions remain managed through the account area.</p>
        <PrimaryButton href={next}>{action}</PrimaryButton>
      </div>
    </AuthLayout>
  );
}

function VerificationStatusPage({ tone, setVerification }: { tone: "pending" | "approved" | "declined"; setVerification: (state: VerificationState) => void }) {
  const content = {
    pending: {
      eyebrow: "Verification",
      title: "Verification under review",
      text: "Your details have been submitted and are being reviewed. Bullion purchasing remains disabled while this manual review is pending.",
      image: "/images/kyc/pending-review.webp",
      alt: "Iconic Bullion verification under review status visual",
      primary: "Back to Account",
      primaryHref: "account",
      secondary: "View Submission",
      secondaryHref: "verification",
      rows: [["Status", "Under Review"], ["Submitted", new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })], ["Account Type", "Individual / Australian Company"]]
    },
    approved: {
      eyebrow: "Verification",
      title: "Verification approved",
      text: "Your account is now verified and bullion purchasing is enabled.",
      image: "/images/kyc/approved-status.webp",
      alt: "Iconic Bullion verification approved status visual",
      primary: "Browse Bullion",
      primaryHref: "bullion",
      secondary: "Go to Account",
      secondaryHref: "account",
      rows: [["Status", "Approved"], ["Approved", new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })], ["Purchasing", "Enabled"]]
    },
    declined: {
      eyebrow: "Verification",
      title: "Action required",
      text: "We need some additional information before your account can be approved.",
      image: "/images/kyc/action-required.webp",
      alt: "Iconic Bullion action required verification visual",
      primary: "Update Verification",
      primaryHref: "verification",
      secondary: "Contact Support",
      secondaryHref: "contact",
      rows: [["Status", "Action Required"], ["Reason", "Additional document required"], ["Next Step", "Update verification details"]]
    }
  }[tone];

  useEffect(() => {
    setVerification(tone === "approved" ? "approved" : tone);
  }, [setVerification, tone]);

  return (
    <AccountShell active="verification" className="verification-account">
    <section className={cx("verification-status-page", tone)}>
      <div className="verification-status-copy">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.text}</p>
        <div className="review-grid">
          {content.rows.map(([label, value]) => (
            <Info key={label} label={label} value={value} />
          ))}
        </div>
        <div className="split-actions">
          <PrimaryButton href={content.primaryHref}>{content.primary}</PrimaryButton>
          <PrimaryButton href={content.secondaryHref} variant="secondary">{content.secondary}</PrimaryButton>
        </div>
      </div>
      <OptimisedImage src={content.image} alt={content.alt} className="verification-status-image" priority sizes="(max-width: 900px) 100vw, 50vw" />
    </section>
    </AccountShell>
  );
}

function SerialPage({ serial, setSerial }: { serial: string; setSerial: (serial: string) => void }) {
  const record = serialRegistry[serial as keyof typeof serialRegistry];
  return (
    <section className="page-shell">
      <SectionHead eyebrow="Serial Verification" title="Verify Iconic-branded bullion" />
      <div className="split-section">
        <PlaceholderImage src="/images/serial/barcode-scan.jpg" />
        <div className="form-card">
          <label>
            Enter serial number
            <input value={serial} onChange={(event) => setSerial(event.target.value)} />
          </label>
          <PrimaryButton variant="secondary" onClick={() => setSerial("IB-10G-000219")}>
            Use Valid Demo Serial
          </PrimaryButton>
          {record ? (
            <div className="verified-result">
              <BadgeCheck size={30} />
              <h2>Authenticity Verified</h2>
              <Info label="Product" value={record.product} />
              <Info label="Weight" value={record.weight} />
              <Info label="Purity" value={record.purity} />
              <Info label="Serial" value={record.serial} />
              <Info label="Status" value={record.status} />
              <div className="split-actions">
                <PrimaryButton href="certificate">View Certificate</PrimaryButton>
                <button className="btn secondary" onClick={() => window.print()}>
                  Print Certificate
                </button>
              </div>
            </div>
          ) : (
            <div className="error-box">
              <AlertTriangle />
              <strong>Serial not found</strong>
              <p>Check the serial number and try again. Public lookup is only for Iconic-branded bullion.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function WholesalePage() {
  const [values, setValues] = useState({
    businessName: "",
    contactName: "",
    phone: "",
    email: "",
    abn: "",
    products: "",
    orderSize: "",
    message: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const fields = [
    ["businessName", "Business Name", "text", "Iconic Trading Pty Ltd"],
    ["contactName", "Contact Name", "text", "Avery Morgan"],
    ["phone", "Phone", "tel", "+61 400 000 000"],
    ["email", "Email", "email", "trade@example.com"],
    ["abn", "ABN / ACN", "text", "12 345 678 901"],
    ["products", "Products / Interest", "text", "1kg gold bars, minted bars"],
    ["orderSize", "Preferred Order Size", "text", "Indicative weight or value"]
  ] as const;

  function updateWholesaleField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submitWholesaleEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!values.businessName.trim()) nextErrors.businessName = "Enter your business name.";
    if (!values.contactName.trim()) nextErrors.contactName = "Enter a contact name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!values.message.trim()) nextErrors.message = "Tell us what you would like to discuss.";
    setErrors(nextErrors);
    setSubmitted(Object.keys(nextErrors).length === 0);
  }

  return (
    <section className="wholesale-page">
      <section className="wholesale-hero">
        <div className="wholesale-hero-copy">
          <span className="eyebrow">Wholesale</span>
          <h1>Bullion supply for trade and business customers</h1>
          <p>Enquire about weights, brands, bulk availability and business account verification.</p>
          <p>We support trade, business and bulk bullion enquiries with a refined and transparent supply experience.</p>
          <div className="split-actions">
            <a className="btn primary" href="#wholesale-enquiry">
              Wholesale Enquiry
            </a>
            <PrimaryButton href="bullion" variant="secondary">
              View Bullion
            </PrimaryButton>
          </div>
        </div>
        <OptimisedImage
          src="/images/wholesale/wholesale-hero.webp"
          alt="Gold bullion prepared for wholesale and business supply"
          className="wholesale-hero-image"
          priority
          sizes="(max-width: 900px) 100vw, 56vw"
          position="center"
        />
      </section>
      <section className="wholesale-split stock">
        <OptimisedImage src="/images/wholesale/wholesale-stock.webp" alt="Trade-ready bulk gold bullion inventory" className="wholesale-section-image" sizes="(max-width: 900px) 100vw, 48vw" />
        <div className="wholesale-section-copy">
          <span className="eyebrow">Trade Supply</span>
          <h2>Trade-ready bullion supply</h2>
          <p>Business customers can enquire about bulk availability, weight preferences, branded product requirements and account-based purchasing needs.</p>
          <ul className="check-list wholesale-list">
            <li>
              <Check size={16} /> Range of bullion sizes
            </li>
            <li>
              <Check size={16} /> Bulk supply discussions
            </li>
            <li>
              <Check size={16} /> Trade and business enquiry handling
            </li>
            <li>
              <Check size={16} /> Premium service and response
            </li>
          </ul>
        </div>
      </section>
      <section className="wholesale-split consultation">
        <div className="wholesale-section-copy">
          <span className="eyebrow">Consultation</span>
          <h2>Speak with us about your wholesale needs</h2>
          <p>For trade, business and recurring supply discussions, send an enquiry and our team can assist with availability, product requirements and account setup.</p>
          <a className="btn secondary" href="#wholesale-enquiry">
            Start an Enquiry
          </a>
        </div>
        <OptimisedImage
          src="/images/wholesale/wholesale-consultation.webp"
          alt="Business consultation for wholesale bullion enquiries"
          className="wholesale-section-image"
          sizes="(max-width: 900px) 100vw, 48vw"
        />
      </section>
      <section className="wholesale-form-section" id="wholesale-enquiry" aria-labelledby="wholesale-form-title">
        <div className="wholesale-form-intro">
          <span className="eyebrow">Trade Enquiry</span>
          <h2 id="wholesale-form-title">Wholesale enquiry</h2>
          <p>Tell us about your business, the product types you are interested in, and any bulk or account-related requirements.</p>
          <p>We will review your enquiry and come back to you regarding availability and next steps.</p>
        </div>
        <form className="wholesale-form" noValidate onSubmit={submitWholesaleEnquiry}>
          {fields.map(([name, label, type, placeholder]) => (
            <label key={name} className={errors[name] ? "has-error" : undefined}>
              {label}
              <input
                type={type}
                value={values[name]}
                placeholder={placeholder}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
                onChange={(event) => updateWholesaleField(name, event.target.value)}
              />
              {errors[name] && (
                <span className="field-error" id={`${name}-error`}>
                  {errors[name]}
                </span>
              )}
            </label>
          ))}
          <label className={cx("wide", errors.message && "has-error")}>
            Message
            <textarea
              rows={5}
              value={values.message}
              placeholder="Share product requirements, timing, account needs or other trade enquiry details."
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : undefined}
              onChange={(event) => updateWholesaleField("message", event.target.value)}
            />
            {errors.message && (
              <span className="field-error" id="message-error">
                {errors.message}
              </span>
            )}
          </label>
          <div className="wholesale-form-actions wide">
            <PrimaryButton type="submit">Submit Wholesale Enquiry</PrimaryButton>
            {submitted && (
              <p className="form-success" role="status">
                Thanks. Your wholesale enquiry has been captured in this prototype flow.
              </p>
            )}
          </div>
        </form>
      </section>
      <section className="wholesale-support">
        <OptimisedImage src="/images/wholesale/wholesale-support.webp" alt="Wholesale bullion enquiry support" className="wholesale-support-image" sizes="(max-width: 900px) 100vw, 34vw" />
        <div>
          <span className="eyebrow">Business Supply Support</span>
          <h2>Discuss availability and product range</h2>
          <p>Wholesale enquiries may include business account discussions, product availability and supply requirements. Final fulfilment, pricing and trade arrangements are subject to confirmation.</p>
        </div>
      </section>
    </section>
  );
}

function AboutPage() {
  return (
    <section className="about-page">
      <section className="about-hero">
        <OptimisedImage
          src="/images/about/about-hero.webp"
          alt="Premium gold bullion arranged to represent the Iconic Bullion brand"
          className="about-hero-image"
          priority
          sizes="(max-width: 900px) 100vw, 56vw"
          position="center"
        />
        <div className="about-hero-copy">
          <span className="eyebrow">About Iconic Bullion</span>
          <h1>Professional bullion service with a premium retail experience</h1>
          <p>Iconic Bullion is positioned as a secure Australian bullion business with live pricing, verification-led purchasing and clear bank-transfer ordering.</p>
          <p>We aim to combine transparent bullion access with a premium customer experience built on trust, clarity and product confidence.</p>
        </div>
      </section>
      <section className="about-positioning">
        <span className="eyebrow">Principles</span>
        <h2>What Iconic Bullion stands for</h2>
        <p>A premium Australian bullion experience built around product clarity, transparent live pricing, verification-led purchasing and secure order handling.</p>
      </section>
      <section className="about-card-grid" aria-label="About Iconic Bullion strengths">
        <MiniCard
          image="/images/about/bullion-expertise.webp"
          imageAlt="Gold bullion presented with product information to represent bullion expertise"
          title="Bullion expertise"
          body="Clear product information, pricing context and a straightforward bullion-buying experience."
        />
        <MiniCard
          image="/images/about/wholesale-heritage.webp"
          imageAlt="Investment-grade gold bullion arranged to represent wholesale supply capability"
          title="Wholesale heritage"
          body="Support for business and trade enquiries through a dedicated wholesale pathway."
        />
        <MiniCard
          image="/images/about/security-trust.webp"
          imageAlt="Gold bullion and certificate representing security and trust"
          title="Security and trust"
          body="Verification-led purchasing, clear documentation and a more transparent customer journey."
        />
      </section>
      <section className="about-cta">
        <div>
          <span className="eyebrow">Explore Iconic Bullion</span>
          <h2>Continue with live pricing, bullion products or an enquiry.</h2>
        </div>
        <div className="split-actions">
          <PrimaryButton href="bullion">Shop Bullion</PrimaryButton>
          <PrimaryButton href="market" variant="secondary">
            View Live Gold Price
          </PrimaryButton>
          <PrimaryButton href="contact" variant="ghost">
            Enquire
          </PrimaryButton>
        </div>
      </section>
    </section>
  );
}

function ContactPage() {
  const [values, setValues] = useState({
    category: "Bullion Product",
    name: "",
    email: "",
    phone: "",
    productReference: "",
    message: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const categories = ["Bullion Product", "Jewellery", "Product Availability", "Pricing", "Delivery", "Verification", "Wholesale", "General Enquiry"];

  function updateContactField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setSubmitted(false);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submitContactEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!values.category.trim()) nextErrors.category = "Choose an enquiry category.";
    if (!values.name.trim()) nextErrors.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!values.message.trim()) nextErrors.message = "Tell us what you need help with.";
    setErrors(nextErrors);
    setSubmitted(Object.keys(nextErrors).length === 0);
  }

  return (
    <section className="contact-page">
      <section className="contact-hero">
        <div className="contact-form-column">
          <div className="contact-intro">
            <span className="eyebrow">Contact</span>
            <h1>Make an enquiry</h1>
            <p>Tell us what you need help with and our team can assist with bullion products, pricing, availability, delivery, verification and wholesale enquiries.</p>
          </div>
          <form className="contact-form" noValidate onSubmit={submitContactEnquiry}>
            <label className={errors.category ? "has-error" : undefined}>
            Category
              <select
                value={values.category}
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "contact-category-error" : undefined}
                onChange={(event) => updateContactField("category", event.target.value)}
              >
                {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
              {errors.category && (
                <span className="field-error" id="contact-category-error">
                  {errors.category}
                </span>
              )}
          </label>
            <label className={errors.name ? "has-error" : undefined}>
            Name
              <input
                value={values.name}
                placeholder="Your name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "contact-name-error" : undefined}
                onChange={(event) => updateContactField("name", event.target.value)}
              />
              {errors.name && (
                <span className="field-error" id="contact-name-error">
                  {errors.name}
                </span>
              )}
          </label>
            <label className={errors.email ? "has-error" : undefined}>
            Email
              <input
                type="email"
                value={values.email}
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                onChange={(event) => updateContactField("email", event.target.value)}
              />
              {errors.email && (
                <span className="field-error" id="contact-email-error">
                  {errors.email}
                </span>
              )}
          </label>
            <label>
              Phone
              <input type="tel" value={values.phone} placeholder="+61 400 000 000" onChange={(event) => updateContactField("phone", event.target.value)} />
            </label>
            <label className="wide">
              Product / Reference
              <input value={values.productReference} placeholder="Product, order or serial reference if relevant" onChange={(event) => updateContactField("productReference", event.target.value)} />
            </label>
            <label className={cx("wide", errors.message && "has-error")}>
            Message
              <textarea
                rows={5}
                value={values.message}
                placeholder="Share product questions, pricing needs, delivery details or other enquiry context."
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "contact-message-error" : undefined}
                onChange={(event) => updateContactField("message", event.target.value)}
              />
              {errors.message && (
                <span className="field-error" id="contact-message-error">
                  {errors.message}
                </span>
              )}
          </label>
            <div className="contact-form-actions wide">
              <PrimaryButton type="submit">Send Enquiry</PrimaryButton>
              {submitted && (
                <p className="form-success" role="status">
                  Thanks. Your enquiry has been captured in this prototype flow.
                </p>
              )}
            </div>
        </form>
        </div>
        <aside className="contact-side-panel" aria-label="Contact details">
          <OptimisedImage
            src="/images/contact/contact-hero.webp"
            alt="Premium customer consultation environment for Iconic Bullion enquiries"
            className="contact-hero-image"
            priority
            sizes="(max-width: 900px) 100vw, 42vw"
          />
          <div className="contact-details">
            <Info label="Phone" value="+61 3 0000 0000" />
            <Info label="Email" value="hello@iconicbullion.example" />
            <Info label="Address" value="Future business address placeholder" />
          </div>
        </aside>
      </section>
      <section className="contact-support">
        <OptimisedImage src="/images/contact/contact-support.webp" alt="Secure bullion pickup and consultation support" className="contact-support-image" sizes="(max-width: 900px) 100vw, 44vw" />
        <div>
          <span className="eyebrow">Customer Support</span>
          <h2>Support for pickup, delivery and order assistance</h2>
          <p>We can assist with questions related to store pickup, insured delivery, product collection, order support and other customer-service enquiries.</p>
          <div className="split-actions">
            <PrimaryButton href="bullion" variant="secondary">
              View Bullion
            </PrimaryButton>
            <PrimaryButton href="market" variant="ghost">
              Explore Live Gold Pricing
            </PrimaryButton>
          </div>
        </div>
      </section>
    </section>
  );
}

function FAQPage() {
  return (
    <section className="page-shell narrow">
      <SectionHead eyebrow="FAQ" title="Bullion support topics" />
      <FAQAccordion />
    </section>
  );
}

function PolicyPage({ route }: { route: string }) {
  const titles: Record<string, string> = {
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
    "delivery-policy": "Delivery Policy",
    "refund-policy": "Refund & Cancellation Policy",
    "bullion-trading-policy": "Bullion Trading / KYC Policy"
  };
  return (
    <section className="page-shell legal">
      <span className="eyebrow">Policy</span>
      <h1>{titles[route]}</h1>
      <p>
        This page contains prototype legal content only. Final wording should be reviewed and approved by the client and legal advisers before production launch.
      </p>
      {route === "refund-policy" && <p className="notice">Bullion sales: no cancellation / refund according to current business instruction.</p>}
      {route === "delivery-policy" && <p>Store pickup is free. Insured delivery is represented by configurable placeholder pricing pending shipping configuration.</p>}
      {route === "bullion-trading-policy" && <p>Account creation and verification are required before bullion purchasing is enabled for individuals and Australian companies.</p>}
      <h2>Prototype scope</h2>
      <p>No live payment, GreenID, MYOB, courier, email or market-price API integrations are active in this prototype.</p>
    </section>
  );
}

function SearchPage({
  query,
  setQuery,
  products,
  onAdd,
  verification
}: {
  query: string;
  setQuery: (query: string) => void;
  products: BullionProduct[];
  onAdd: (product: BullionProduct) => void;
  verification: VerificationState;
}) {
  return (
    <section className="page-shell">
      <SectionHead eyebrow="Search" title="Search bullion" />
      <div className="search-field">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search brand, weight or product" />
      </div>
      {products.length ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={onAdd} verification={verification} />
          ))}
        </div>
      ) : (
        <StatePage kind="no-results" embedded />
      )}
    </section>
  );
}

function StatePage({ kind, embedded }: { kind: string; embedded?: boolean }) {
  const copy: Record<string, [string, string, string, string?]> = {
    "no-results": ["No results", "No bullion products match that search.", "/images/system/no-results.jpg", "Browse All Bullion"],
    "filter-empty": ["No matching bullion", "No bullion products match your selected filters.", "/images/system/no-results.jpg", "Reset Filters"],
    "empty-cart": ["Your cart is empty", "Add verified bullion products to see the 10-minute price lock.", "/images/cart/price-lock.jpg", "Browse Bullion"],
    "coming-soon": ["Coming Soon", "This premium bullion product state is prepared for future availability.", "/images/system/coming-soon.jpg", "Browse Bullion"],
    "404": ["Page not found", "The page you requested could not be found.", "/images/system/404.jpg", "Return Home"],
    error: ["Something went wrong", "Please try again or contact Iconic Bullion for support.", "/images/system/404.jpg", "Try Again"],
    maintenance: ["Temporary maintenance", "Bullion ordering is paused while the website is being maintained.", "/images/system/maintenance.jpg", "Return Home"],
    "pricing-unavailable": ["Live pricing is temporarily unavailable", "Bullion ordering has been temporarily paused. Purchasable stale pricing is not shown.", "/images/system/pricing-unavailable.jpg", "Contact Us"]
  };
  const item = copy[kind] || copy["404"];
  return (
    <section className={embedded ? "state-card embedded" : "page-shell narrow state-card"}>
      <PlaceholderImage src={item[2]} />
      <h1>{item[0]}</h1>
      <p>{item[1]}</p>
      <div className="split-actions">
        <PrimaryButton href={kind === "pricing-unavailable" ? "contact" : kind === "404" || kind === "maintenance" ? "home" : "bullion"}>{item[3] || "Continue"}</PrimaryButton>
        {kind === "pricing-unavailable" && (
          <PrimaryButton href="market" variant="secondary">
            Try Again
          </PrimaryButton>
        )}
      </div>
    </section>
  );
}

function InstructionPage({ kind, totals }: { kind: "bank" | "pickup" | "delivery"; totals: { total: number } }) {
  const content = {
    bank: ["Bank Transfer Instructions", "Complete your bank transfer externally using the invoice reference.", <Banknote key="bank" />],
    pickup: ["Store Pickup Instructions", "Bring identification and wait for Ready for Pickup status before attending store.", <PackageCheck key="pickup" />],
    delivery: ["Insured Delivery Status", "Tracking is a placeholder pending courier configuration.", <Truck key="delivery" />]
  }[kind];
  return (
    <section className="page-shell narrow">
      <div className="success-panel">
        {content[2]}
        <h1>{content[0]}</h1>
        <p>{content[1]}</p>
        <Info label="Invoice #" value="INV-2026-0188" />
        <Info label="Amount" value={formatAUD(totals.total || 2489.62)} />
        <Info label="Reference" value="IB-10472" />
        <Info label="Status" value={kind === "delivery" ? "Processing" : "Pending for Payment"} />
      </div>
    </section>
  );
}
