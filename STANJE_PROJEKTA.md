# NautiStaff Live – stanje projekta

**Zadnje ažurirano:** 25. 11. 2026. · **Trenutna verzija:** 2.5 (radi na 2 Android mobitela, sve je na GitHubu)

> Za nastavak rada u NOVOM razgovoru s Claudeom: priložite ovu datoteku (i po potrebi zip projekta)
> i napišite „Nastavljamo NautiStaff Live, ovo je stanje projekta".

---

## Što je aplikacija

Mobilna aplikacija za hitno i sezonsko zapošljavanje posade u nautičkom turizmu na Jadranu (skiperi, hostese, kuhari, mornari, serviseri…). Poslodavac (čarter) objavi oglas s rokom za prijave, posada se prijavi jednim dodirom, poslodavac prihvati, a obje strane dobiju međusobni kontakt. Ideja je od cure, a tehničku pomoć daje dečko.

## Tehnologija

| Dio | Alat | Napomena |
| --- | --- | --- |
| Mobilna aplikacija | React Native + Expo (TypeScript) | mapa `Documents\nautistaff` na Windows laptopu |
| Server i baza | Supabase, projekt u regiji Frankfurt | URL `https://suefcxhphcryztwwxiyq.supabase.co` (javni ključ je u `src/config.ts`) |
| Izrada APK-a i ažuriranja | Expo EAS | profil `preview`, kanal `preview`, paket `hr.nautistaff.app` |
| Push obavijesti | Expo push + Google Firebase (FCM V1) | `google-services.json` je u projektu; TAJNI Firebase ključ je u `Documents\tajno` (NE u Git) |
| Kod | Git + GitHub (privatni repozitorij `nautistaff`) | |

## Kako se šalju promjene

| Vrsta promjene | Postupak |
| --- | --- |
| Samo kod u `src\` ili `App.tsx` | kopirati datoteke → `eas update --channel preview --environment preview --message "opis"` → na mobitelu zatvoriti i otvoriti aplikaciju |
| Baza | pokrenuti novu `0X_nadogradnja_….sql` u Supabase SQL Editoru (prazan prozor, Run) |
| Novi dodatak (`npx expo install …`), dozvole, `app.config.js`, `app.json` | povećati `"version"` u `app.json` (1.0.0 → 1.0.1) → `eas build -p android --profile preview` → link: `eas build:list --platform android --limit 1` (redak *Application Archive URL*) → instalirati PREKO stare verzije |
| Nakon svake promjene | `git add .` → `git commit -m "opis"` → `git push` |

Pravilo: zip uvijek raspakirati u NOVU mapu (`nautistaff_v2_X`), pa kopirati `src` i `supabase` u projekt. Pri kopiranju NE prebrisati `src\legal.ts` ako su u njega upisani pravi podaci.

## Baza – redoslijed SQL datoteka (mapa `supabase\`)

| Datoteka | Što radi | Pokrenuto na pravoj bazi |
| --- | --- | --- |
| `00_postavi_bazu_ispocetka.sql` | POSTAVLJA SVE ISPOČETKA – BRIŠE oglase, prijave, tvrtke i profile (računi ostaju). Samo za novi projekt! | ne pokretati ponovno |
| `02_nadogradnja_kalendar.sql` | zauzeti termini, kalendar, end_at | ✔ |
| `03_nadogradnja_zivotni_ciklus.sql` | arhiva, popunjeno, ponovna objava | ✔ |
| `04_nadogradnja_privatnost.sql` | GDPR: uvjeti, privole, prijave, izvoz, brisanje računa | ✔ |
| `05_nadogradnja_6_mjeseci.sql` | oglasi do 6 mjeseci unaprijed | ✔ |

Administrator: poseban račun, uloga postavljena SQL-om
`update public.profiles set role = 'admin' where id = (select id from auth.users where email = '…');`

## Povijest verzija

| Verzija | Sadržaj |
| --- | --- |
| 1 | registracija, live feed s odbrojavanjem, instant prijava, prihvaćanje kandidata u stvarnom vremenu |
| 2 | push obavijesti, lokacija (krug 30 km), CV, licence + plava značka (odobrava admin), kontakt nakon prihvaćanja (poziv, WhatsApp, e-mail), godine iskustva, admin dio |
| 2.1 | automatsko ažuriranje „preko zraka" (EAS Update), oznaka verzije na dnu profila |
| 2.2 | zauzeti termini (nema prijave ni obavijesti za posao koji se preklapa s prihvaćenim), auto-otkazivanje preklapajućih prijava, kalendar posade, blokiranje dana, trajanje oglasa u danima |
| 2.3 | životni ciklus oglasa: Aktualni / Arhiva, „Završi oglas" (Popunjeno / Otkaži), „Objavi ponovno", popunjeni oglasi 3 h prigušeni u ponudama, kandidati na čekanju dobivaju obavijest, prihvaćanje moguće do polaska |
| 2.4 | privatnost i pravni dio: prihvaćanje uvjeta (18+), Uvjeti i Politika u aplikaciji, privola za sanitarnu iskaznicu, isključivanje lokacije, „Preuzmi moje podatke", „Obriši račun", „⚑ Prijavi" oglas/korisnika + admin kartica Prijave, pravne napomene |
| 2.5 | odabir datuma polaska: Danas / Sutra / kalendar do 6 mjeseci; rokovi 7, 14, 30 dana i „Do polaska" |

## Otvorene stavke

- [ ] U `src\legal.ts` upisati naziv i OIB voditelja obrade, adresu i e-mail za privatnost
- [ ] Dokument za odvjetnika (nacrt Uvjeta i Politike, 9 pitanja) poslati odvjetniku: https://claude.ai/artifact/WvjpWdeuUobw9Cf3nzVFYn
- [ ] Odlučiti rok brisanja neaktivnih računa (12 ili 24 mjeseca) – komentar u tom dokumentu
- [ ] Prijatelj (senior developer) da pregleda kod na GitHubu (Settings → Collaborators)
- [ ] Ostatak liste nedostataka koju sastavljate

## Ideje za kasnije (dogovoreno ili predloženo)

- Chat unutar aplikacije
- Ocjene nakon završenog posla (obostrano)
- Naplata: Live Alert 15 € / VIP flota 250 € mj. / paketi S 50 € i M 120 € (Stripe; provjeriti pravila Google/Apple)
- iPhone verzija (Apple Developer račun 99 USD godišnje)
- Objava u Google Playu (tvrtka j.d.o.o. preporučena; za račun organizacije ne treba 14-dnevno testiranje s 12 testera)
- Mogući prelazak na sistemski kalendar uz neku buduću APK izradu (zasad je vlastiti kalendar bolji)
