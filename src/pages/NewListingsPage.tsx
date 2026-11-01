import { Sparkles, Trash2 } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { ListingsBrowser } from '../features/listings/ListingsBrowser';
import { EmptyState, PageHeader } from '../components/ui';
import { isNew } from '../features/listings/filters';

export default function NewListingsPage() {
  const { inRadius, settings, now, imports, clearImports } = useAppData();
  const fresh = inRadius.filter((l) => isNew(l, settings.newListingHours, now));
  return (
    <>
      <PageHeader
        title="Nowe ogłoszenia"
        subtitle={`Wykryte w ciągu ostatnich ${settings.newListingHours} godzin (zmienisz w Ustawieniach). Zaimportowane ręcznie trafiają tu od razu.`}
        actions={
          imports.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => {
                if (confirm(`Usunąć ${imports.length} ręcznie zaimportowanych ogłoszeń z tej przeglądarki?`)) clearImports();
              }}
            >
              <Trash2 size={15} /> Usuń importy ({imports.length})
            </button>
          )
        }
      />
      <ListingsBrowser
        items={fresh}
        initialSort="newest"
        empty={
          <EmptyState icon={<Sparkles size={22} />} title="Brak nowych ogłoszeń">
            Kliknij „Dodaj ogłoszenie”, aby wkleić link i dane z OLX, Allegro Lokalnie czy Facebooka — albo poczekaj na kolejne zaplanowane wyszukiwanie.
          </EmptyState>
        }
      />
    </>
  );
}
