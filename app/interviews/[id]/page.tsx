import { notFound } from "next/navigation";
import InterviewRoom from "@/app/_components/InterviewRoom";
import { UUID_RE } from "@/lib/cv/server";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <InterviewRoom id={id} />;
}
