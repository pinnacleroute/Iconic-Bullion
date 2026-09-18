import { Suspense } from "react";
import { IconicPrototype } from "@/components/IconicPrototype";

const staticRoutes = [
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
];

export function generateStaticParams() {
  return staticRoutes.map((route) => ({ slug: route.split("/") }));
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <IconicPrototype route={slug.join("/")} />
    </Suspense>
  );
}
