import { useSearchParams } from 'react-router-dom';
import { useAppData } from '../hooks/AppData';
import { ListingsBrowser } from '../features/listings/ListingsBrowser';
import { PageHeader } from '../components/ui';

export default function DealsPage() {
  const { inRadius, settings } = useAppData();
  const [params] = useSearchParams();
  const gems = params.get('gems') === '1';
  return (
    <>
      <PageHeader
        title={gems ? 'Unknown Gems' : 'Najlepsze okazje'}
        subtitle={
          gems
            ? 'Rowery nierozpoznane przez bazę modeli, ale z sygnałami jakości. Zawsze sprawdź zdjęcia naklejek przed zakupem.'
            : `Wszystkie ogłoszenia w promieniu, posortowane wg Deal Score. Okazja = cena ≥ ${settings.dealThresholdPct}% poniżej szacowanej wartości, przy przyzwoitej ramie i bez czerwonych flag.`
        }
      />
      <ListingsBrowser key={gems ? 'gems' : 'all'} items={inRadius} initialFilters={gems ? { onlyGems: true } : undefined} />
    </>
  );
}
