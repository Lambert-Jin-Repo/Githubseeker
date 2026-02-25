import { use } from "react";
import { ScoutResultsClient } from "./ScoutResultsClient";

interface ScoutResultsPageProps {
  params: Promise<{ id: string }>;
}

export default function ScoutResultsPage({ params }: ScoutResultsPageProps) {
  const { id } = use(params);
  return <ScoutResultsClient searchId={id} />;
}
