import { HomePageClient } from "@/components/HomePageClient";
import { isQdrantConfigured } from "@/lib/env";

export default function HomePage() {
  return <HomePageClient qdrantConfigured={isQdrantConfigured()} />;
}
