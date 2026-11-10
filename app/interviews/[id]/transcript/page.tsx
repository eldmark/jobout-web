import { notFound } from "next/navigation";
import InterviewTranscript from "@/app/_components/InterviewTranscript";
import { UUID_RE } from "@/lib/cv/server";

export const dynamic = "force-dynamic";

export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <InterviewTranscript id={id} />;
}
