import { notFound } from "next/navigation";
import RecruiterPanel from "@/app/_components/RecruiterPanel";
import { UUID_RE } from "@/lib/cv/server";

export const dynamic = "force-dynamic";

export default async function PanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <RecruiterPanel offerId={id} />;
}
