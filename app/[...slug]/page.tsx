import { Suspense } from "react";
import { IconicPrototype } from "@/components/IconicPrototype";

export default async function RoutePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <IconicPrototype route={slug.join("/")} />
    </Suspense>
  );
}
