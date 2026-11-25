// =====================================================================
// PRAVNI TEKSTOVI (NACRT) - prije javnog lansiranja mora ih pregledati odvjetnik.
// Kad promijenite tekst Uvjeta ili Politike, povećajte TERMS_VERSION:
// svi korisnici će pri sljedećem otvaranju aplikacije morati ponovno prihvatiti.
// =====================================================================

export const TERMS_VERSION = '2026-11-25';

// >>> UPIŠITE PRAVE PODATKE <<<
export const OPERATOR_NAME = '[LEA GELIC 38351174926]';
export const OPERATOR_ADDRESS = '[Opata Gebizona 10, Klis]';
export const PRIVACY_EMAIL = '[lea.gelic@gmail.com]';

export type LegalSection = { title: string; body: string[] };

export const TERMS: LegalSection[] = [
  {
    title: '1. Što je NautiStaff Live',
    body: [
      `NautiStaff Live (u daljnjem tekstu: Platforma) je tehnološka platforma i oglasnik kojom upravlja ${OPERATOR_NAME}. Platforma omogućuje poslodavcima u nautičkom turizmu (čarter agencijama, vlasnicima i zapovjednicima plovila) objavu oglasa, a pomorcima i drugom osoblju prijavu na te oglase.`,
      'Platforma NIJE agencija za zapošljavanje, posrednik pri zapošljavanju ni agencija za ukrcaj pomoraca. Platforma ne zapošljava, ne ukrcava i ne upućuje osobe na rad te nije strana u bilo kakvom ugovoru između poslodavca i radnika.',
    ],
  },
  {
    title: '2. Korisnički račun',
    body: [
      'Platformu smiju koristiti samo punoljetne osobe (18 godina i više) i pravne osobe koje zastupa ovlaštena osoba.',
      'Korisnik je dužan unositi istinite i točne podatke te čuvati tajnost lozinke. Korisnik odgovara za sve radnje učinjene putem svog računa.',
    ],
  },
  {
    title: '3. Oglasi, prijave i prihvaćanje',
    body: [
      'Poslodavac je odgovoran za točnost i zakonitost svojih oglasa (opis posla, termin, naknada, uvjeti).',
      'Prihvaćanje prijave u aplikaciji znači samo da su poslodavac i radnik iskazali interes za suradnju i razmijenili kontakt podatke. Prihvaćanje NE predstavlja sklapanje ugovora o radu, ugovora o djelu ni bilo kojeg drugog ugovora.',
      'Ugovor o angažmanu poslodavac i radnik sklapaju izravno, izvan Platforme.',
    ],
  },
  {
    title: '4. Zakonski okvir rada u Republici Hrvatskoj',
    body: [
      'Poslodavac i radnik dužni su angažman urediti u skladu s propisima Republike Hrvatske, na primjer ugovorom o radu (uključujući sezonski rad), ugovorom o djelu, putem obrta ili paušalnog obrta, odnosno ugovorom o ukrcaju i pomorskom knjižicom kada je to propisano.',
      'Prijava na obvezna osiguranja, obračun i plaćanje poreza i doprinosa te isplata dogovorene naknade isključiva su obveza ugovornih strana. Platforma ne sudjeluje u isplatama i ne ulazi u porezno-pravni odnos između poslodavca i radnika.',
    ],
  },
  {
    title: '5. Verifikacija dokumenata',
    body: [
      'Oznaka „✔ VERIFICIRAN" znači da je administrator Platforme vizualno pregledao kopiju (fotografiju ili PDF) dokumenta koju je korisnik priložio.',
      'Oznaka NE jamči autentičnost, valjanost ni potpunost dokumenta, niti stručnost ili pouzdanost korisnika.',
      'Poslodavac je prije početka rada odnosno isplovljavanja dužan osobno provjeriti izvornike svih potrebnih isprava (ovlaštenja za upravljanje brodicom ili jahtom, STCW svjedodžbe, pomorske knjižice, sanitarne iskaznice, police osiguranja i sl.).',
    ],
  },
  {
    title: '6. Ograničenje odgovornosti',
    body: [
      'U najvećoj mjeri dopuštenoj zakonom, Platforma ne odgovara za:',
      '• štetu na plovilu, opremi ili imovini, kao ni za štetu nanesenu osobama, koju prouzroči korisnik;',
      '• neisplatu, kašnjenje ili spor oko dogovorene naknade;',
      '• nedolazak, otkazivanje ili kašnjenje radnika ili poslodavca, uključujući otkazivanje neposredno prije isplovljavanja;',
      '• točnost oglasa, profila i dokumenata koje su unijeli korisnici;',
      '• prekide u radu Platforme, gubitak podataka ili nedostavljene obavijesti.',
    ],
  },
  {
    title: '7. Zabranjeno ponašanje i prijava sadržaja',
    body: [
      'Zabranjeno je objavljivati lažne ili obmanjujuće oglase, diskriminirajuće ili uvredljive sadržaje, oglase za neprijavljeni rad, tuđe osobne podatke bez privole te koristiti Platformu za prijevaru ili uznemiravanje.',
      'Svaki korisnik može prijaviti sumnjiv oglas ili korisnika putem opcije „⚑ Prijavi". Platforma prijave pregledava i može ukloniti sadržaj te privremeno ili trajno onemogućiti račun.',
    ],
  },
  {
    title: '8. Naknade',
    body: [
      'Tijekom testne faze korištenje Platforme je besplatno. O uvođenju plaćenih usluga (npr. Live Alert, VIP paket) korisnici će biti obaviješteni unaprijed, uz jasno istaknute cijene.',
    ],
  },
  {
    title: '9. Prestanak korištenja',
    body: [
      'Korisnik u svakom trenutku može obrisati svoj račun u aplikaciji (Profil ili Tvrtka → Privatnost i račun → Obriši račun).',
    ],
  },
  {
    title: '10. Izmjene i mjerodavno pravo',
    body: [
      'Platforma može izmijeniti ove Uvjete. O bitnim izmjenama korisnici će biti obaviješteni u aplikaciji te ih moraju ponovno prihvatiti.',
      'Na ove Uvjete primjenjuje se pravo Republike Hrvatske. Kontakt: ' + PRIVACY_EMAIL + '.',
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: '1. Voditelj obrade',
    body: [`${OPERATOR_NAME}, ${OPERATOR_ADDRESS}. Kontakt za sva pitanja o osobnim podacima: ${PRIVACY_EMAIL}.`],
  },
  {
    title: '2. Koje podatke obrađujemo',
    body: [
      '• Podaci računa: ime i prezime, e-mail, lozinka (pohranjena isključivo u kriptiranom obliku).',
      '• Profil posade: zanimanje, godine iskustva, jezici, plovila, opis, dostupnost.',
      '• Kontakt: broj mobitela.',
      '• Životopis (CV) i dokumenti: ovlaštenja, svjedodžbe, potvrde i njihovi datumi valjanosti.',
      '• Zdravstveni podaci: sanitarna iskaznica. To je posebna kategorija osobnih podataka i obrađuje se samo uz vašu izričitu privolu.',
      '• Lokacija: približna zadnja poznata lokacija uređaja, samo ako to dopustite.',
      '• Podaci o korištenju: oglasi, prijave, kalendar dostupnosti, prijave sadržaja.',
      '• Tehnički podaci: oznaka uređaja za push obavijesti.',
      '• Poslodavci: naziv tvrtke, OIB, flota, baza, kontakt.',
    ],
  },
  {
    title: '3. Svrhe i pravne osnove',
    body: [
      '• Pružanje usluge Platforme (račun, oglasi, prijave, obavijesti, kontakt nakon prihvaćanja): izvršenje ugovora, čl. 6. st. 1. t. (b) GDPR-a.',
      '• Lokacija za ponude u blizini: privola, čl. 6. st. 1. t. (a). Privolu možete povući u Profilu ili u postavkama mobitela.',
      '• Sanitarna iskaznica: izričita privola, čl. 9. st. 2. t. (a). Privolu možete povući brisanjem dokumenta.',
      '• Sigurnost, sprječavanje zlouporabe i obrada prijava sadržaja: legitimni interes, čl. 6. st. 1. t. (f).',
      '• Ispunjavanje zakonskih obveza: čl. 6. st. 1. t. (c).',
    ],
  },
  {
    title: '4. Tko vidi vaše podatke',
    body: [
      '• Poslodavac kojem se prijavite: vaš profil, oznaku verifikacije i CV.',
      '• Broj mobitela i e-mail vidi samo druga strana i to tek NAKON što je prijava prihvaćena.',
      '• Dokumente (licence, sanitarnu iskaznicu) vidi samo administrator Platforme radi verifikacije.',
      '• Izvršitelji obrade s kojima imamo ugovor: Supabase (pohrana podataka, poslužitelji u EU, Frankfurt), Expo (isporuka aplikacije i obavijesti), Google Firebase Cloud Messaging (dostava push obavijesti). Kada se podaci prenose izvan EU-a, to se radi uz odgovarajuće zaštitne mjere propisane GDPR-om.',
      '• Vaše podatke ne prodajemo i ne koristimo ih za oglašavanje trećih strana.',
    ],
  },
  {
    title: '5. Koliko dugo čuvamo podatke',
    body: [
      '• Dok imate račun. Brisanjem računa odmah se brišu profil, kontakt, CV, dokumenti, prijave i kalendar.',
      '• Prijave sadržaja čuvaju se i nakon brisanja računa, bez podataka o podnositelju, radi sigurnosti Platforme.',
      '• Sigurnosne kopije sustava mogu sadržavati podatke do [BROJ] dana nakon brisanja.',
      '• Neaktivni računi: [ROK, npr. brisanje nakon 24 mjeseca neaktivnosti uz prethodnu obavijest].',
    ],
  },
  {
    title: '6. Vaša prava',
    body: [
      '• Pristup i prenosivost: Profil ili Tvrtka → Privatnost i račun → Preuzmi moje podatke.',
      '• Ispravak: izravno u profilu.',
      '• Brisanje: Privatnost i račun → Obriši račun.',
      '• Povlačenje privole, ograničenje obrade i prigovor: putem e-maila ' + PRIVACY_EMAIL + '.',
      '• Pritužba nadzornom tijelu: Agencija za zaštitu osobnih podataka (AZOP), www.azop.hr.',
    ],
  },
  {
    title: '7. Sigurnost',
    body: [
      'Podaci se prenose šifrirano. Dokumenti i CV-ovi pohranjeni su u privatnim spremnicima, a pristup im je ograničen pravilima na razini baze podataka.',
    ],
  },
  {
    title: '8. Izmjene',
    body: ['O bitnim izmjenama ove Politike obavijestit ćemo vas u aplikaciji.'],
  },
];

export const EMPLOYER_NOTICE =
  'NautiStaff Live je oglasnik i nije strana u ugovoru. Angažman posade ugovarate izravno i u skladu s propisima RH (ugovor o radu ili sezonski rad, ugovor o djelu, obrt, ugovor o ukrcaju). Prijava na osiguranje, porezi i isplata vaša su obveza.';

export const VERIFIED_NOTICE =
  '✔ VERIFICIRAN znači da je administrator pregledao priloženu kopiju dokumenta. Prije isplovljavanja obavezno provjerite izvornike (ovlaštenja, STCW, pomorska knjižica, osiguranje).';

export const WORKER_NOTICE =
  'Prije početka rada s poslodavcem dogovorite legalan oblik angažmana (ugovor o radu ili sezonski rad, ugovor o djelu, obrt…). NautiStaff Live nije strana u tom odnosu i ne sudjeluje u isplati.';

export const HEALTH_CONSENT_TEXT =
  'Sanitarna iskaznica sadrži podatke o zdravlju, koji su posebna kategorija osobnih podataka. Izričito pristajem da NautiStaff Live obrađuje ovaj dokument isključivo radi provjere i prikaza oznake verifikacije poslodavcima. Privolu mogu povući u svakom trenutku brisanjem dokumenta.';
