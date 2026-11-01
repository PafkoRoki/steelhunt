import { Bookmark } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { ListingsBrowser } from '../features/listings/ListingsBrowser';
import { EmptyState, PageHeader } from '../components/ui';

export default function WatchlistPage() {
  const { listings, watchlist } = useAppData();
  const items = listings.filter((l) => watchlist.includes(l.listing.id));
  const missing = watchlist.length - items.length;
  return (
    <>
      <PageHeader
        title="Obserwowane"
        subtitle={`Zapisane w tej przeglądarce. Zmiany ceny widać w szczegółach ogłoszenia.${missing > 0 ? ` ${missing} obserwowanych ogłoszeń nie ma już w danych (usunięte lub wyłączone demo).` : ''}`}
      />
      <ListingsBrowser
        items={items}
        initialFilters={{ hideDuplicates: false }}
        empty={
          <EmptyState icon={<Bookmark size={22} />} title="Nic tu jeszcze nie ma">
            Kliknij „Obserwuj” na karcie ogłoszenia, aby śledzić je tutaj.
          </EmptyState>
        }
      />
    </>
  );
}
