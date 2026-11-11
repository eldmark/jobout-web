import OffersList from "@/app/_components/OffersList";
import { consultaDeUrl } from "@/lib/offers/url";

export const dynamic = "force-dynamic";

/** BUG-017: el orden y los filtros salen de la URL; el cursor nunca. */
export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <OffersList initial={consultaDeUrl(await searchParams)} />;
}
