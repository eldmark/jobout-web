import { notFound } from "next/navigation";
import OfferEditor from "@/app/_components/OfferEditor";
import { UUID_RE } from "@/lib/cv/server";

export const dynamic = "force-dynamic";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <OfferEditor id={id} />;
}
