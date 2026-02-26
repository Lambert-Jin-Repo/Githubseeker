import { use } from "react";
import { DeepDivePageClient } from "./DeepDivePageClient";

interface DeepDivePageProps {
  params: Promise<{ id: string }>;
}

export default function DeepDivePage({ params }: DeepDivePageProps) {
  const { id } = use(params);
  return <DeepDivePageClient searchId={id} />;
}
