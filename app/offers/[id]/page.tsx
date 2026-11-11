import { notFound } from "next/navigation";
import OfferDetail from "@/app/_components/OfferDetail";
import { UUID_RE } from "@/lib/cv/server";

export const dynamic = "force-dynamic";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <OfferDetail id={id} />;
}
