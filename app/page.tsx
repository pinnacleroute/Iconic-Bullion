import { Suspense } from "react";
import { IconicPrototype } from "@/components/IconicPrototype";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <IconicPrototype route="home" />
    </Suspense>
  );
}
