# Verifiche effettive — aggiornamento 23 ottobre 2026

Questo documento separa implementazione, controlli automatici e dispositivi fisici. Non certifica Bluetooth in assenza di hardware.

## Implementazione completata

Expo/React Native/TypeScript e modulo Android Kotlin locale, trasporto Bluetooth Classic con host e sette slot RFCOMM, discovery SDP e associazione Android, trasporto TCP LAN, lobby con approvazione e ruoli, motore autorevole sul telefono host, framing, validazione, snapshot filtrati, credenziali SecureRandom, versionamento, deduplicazione durabile, serializzazione dei comandi, presenza e recupero, persistenza AtomicFile, UI italiana, QR, regole, preferenze, font e contenuti offline, licenze e script di build.

## Controlli eseguiti

- `npm run typecheck`: superato.
- `npm test`: **29 test** superati nelle suite motore, protocollo e runtime. I test del runtime sostituiscono l’I/O nativo esclusivamente nel processo di test.
- `npx expo prebuild --platform android --no-install`: superato, incluso autolinking di `offline-link`.
- `npx expo export --platform android --output-dir dist`: superato; bundle Hermes Android e cinque file font incorporati. È una verifica del bundle, non del multiplayer.
- `:offline-link:testReleaseUnitTest`: **4 test JVM** superati, XML in `modules/offline-link/android/build/test-results/testReleaseUnitTest/`. Codec Kotlin: frame frammentati e concatenati, UTF-8, dimensioni, troncamento.
- `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64`: superato. APK autonomo con JavaScript incorporato, firmato con chiave debug Android per collaudo. Include controllo lint vital della variante release.
- `npm run licenses`: testi licenza delle dipendenze conservati in un file testuale e nel JSON incluso nell’app.
- `npm run format:check`: superato dopo formattazione dei sorgenti.
- `apksigner verify --print-certs`: firma APK verificata; certificato Android Debug di collaudo.
- `aapt dump badging`: verificati package `org.opencodenames.app`, min SDK 24, target 36, ARM64 e x86_64. Manifest finale senza permessi microfono o archiviazione esterna, Bluetooth con limiti di versione e scansione `neverForLocation`.

## Verifica dell’APK su emulatore e socket TCP effettivi

Emulatore Android API 36 `Medium_Phone_API_36`, avvio pulito senza snapshot. Installazione dell’APK release riuscita e primo avvio con Wi-Fi disattivato; Home e font disponibili senza Metro. Il comando `svc data disable` ha inizialmente restituito assenza del servizio telephony nell’emulatore, quindi non viene usato come prova del requisito radio sui telefoni. Durante l’avvio dell’emulatore sono comparsi un ANR della UI di sistema e un timeout del comando uiautomator; l’app Open Codenames non ha prodotto crash nei controlli successivi.

Il trasporto LAN è stato provato con **un host nell’APK e tre client Node di collaudo**, collegati tramite `adb forward` a socket Android reali. Non è I/O sostituito e non è una prova di quattro Android fisici. Risultati osservati:

1. Tre richieste contemporanee e approvazione manuale nella UI Android; quattro presenze simultanee, versione 4 dopo il recupero iniziale.
2. ECO bidirezionale verificato per tutti e tre i client.
3. Scelta di due suggeritori e un indovinatore dai client; disponibilità dell’host dalla UI. Avvio bloccato prima della composizione valida, consentito dopo.
4. Distacco e rientro della seconda sessione senza duplicazione della persona (versioni 11–12).
5. Avvio del motore nell’APK (v14), indizio del suggeritore autenticato (v15), conferma nativa prima della carta dell’host e aggiornamento a tutti i client (v16).
6. Secondo indizio (v17), assassino scelto dall’indovinatore e risultato concorde (v18, vittoria rossa). Snapshot per entrambi i suggeritori completi, per gli indovinatori privi dei colori coperti; controllo eseguito su ogni snapshot ricevuto dal client di collaudo.
7. Aggiornamento/riavvio dell’APK, “Riapri la tua stanza”, recupero della stessa partita conclusa e rientro di tutte e tre le sessioni (v19–22). Nessun vecchio comando applicato al recupero.
8. Ispezione visiva finale e albero accessibile: griglia di **5 righe × 5 colonne**, 25 carte, parole intere con ridimensionamento del font. È stato corretto un difetto di arrotondamento che nella prima build disponeva quattro colonne.

La partita completa e gli ECO sono stati eseguiti sulla build con SHA-256 `44e3dc969a632e201bf57d973a6f022656bd7f08b6acd365925680da5b52d748`; la correzione finale del solo layout è nella build `0919d38cc902121dac2696097eadc7fded545d3c9dfe6e3a8ccda7815b515402`, sulla quale sono stati ripetuti installazione, recupero host, rientro dei tre client e ispezione 5×5. Log finale build: `artifacts/build-final.log`. Immagini di Home e tabellone: `artifacts/screenshots/home.png` e `board.png`.

Il primo tentativo di Gradle è fallito per l’accesso di rete della sandbox; è stato ripetuto con accesso autorizzato. Il successivo ha rilevato un `versionName` mancante nel modulo locale, corretto prima della build riuscita. SDK Platform 36, NDK 27.1.12297006 e CMake 3.22.1 sono stati installati dal tooling Android, usando le licenze SDK già accettate nella macchina. Nessun controllo fallito è conteggiato come superato.

## Copertura dei test

Distribuzione 9/8/7/1, parole distinte, dizionario strutturale, due squadre iniziali, composizione lobby, ruoli bloccati e autorizzazioni, progressione, N+1, zero e infinito, almeno un tentativo, vittoria propria/avversaria e assassino, pause, annullamento e nuova lobby, sintassi indizi, normalizzazione, colori esclusi da host/client indovinatori, entrambi i suggeritori, framing UTF-8 frammentato, schema e versione protocollo, credenziali e isolamento partite, revoca, duplicati anche dopo recupero, concorrenza su versione, errore di persistenza senza pubblicazione, recupero della presenza, massimo partecipanti, ingresso/approvazione di tre client, ECO, rientro, spoofing di identità, pausa background e assenza di replay dopo distacco.

## Dispositivi fisici — nessuna verifica eseguita

`adb devices` iniziale non elencava telefoni fisici. Il collaudo richiesto su quattro Android non è stato eseguito. Restano da verificare capacità simultanea host + tre client Bluetooth, associazione fra produttori/versioni, partita completa con Wi-Fi e dati spenti, range, interferenze, perdita/rientro, arresto/recupero host, battery saver, blocco schermo, accessibilità su telefono e hotspot reale senza Internet. Procedura pronta in [DEVICE_TEST.md](DEVICE_TEST.md).

**Nessun numero di telefoni fisici è stato collaudato.** La versione 0.2.0 configura dieci partecipanti globali: fino a otto Bluetooth diretti, fino a dieci con ponte sperimentale oppure dieci LAN. Il modulo richiede di poter aprire sette listener RFCOMM sull’host e due sul ponte mantenendo il collegamento uscente; un telefono che non li offre segnala errore. L’effettiva compatibilità radio, soprattutto per il collegamento contemporaneo client/server del ponte, deve essere stabilita dal collaudo. Nessuna promessa di funzionamento continuo in background, protezione da host modificato o confidenzialità su LAN ostile (TCP senza TLS). Recupero automatico LAN vincolato all’indirizzo locale salvato.

## Dipendenze

Eseguito `npm audit` e applicati gli aggiornamenti compatibili con `npm audit fix`; Vitest aggiornato a **5.0.5**, con 29 test nuovamente superati. `npm audit --omit=dev` finale segnala 28 avvisi (5 moderati, 23 alti, 0 critici) nell’albero Expo/Metro e dipendenze di compilazione, alcuni senza fix compatibile pubblicato per SDK 54. Report conservato in `artifacts/dependency-audit.json`. Non viene dichiarata assenza di vulnerabilità. L’app release non avvia Metro o server di test; gli avvisi del tooling richiedono comunque manutenzione prima di distribuzioni pubbliche. Il progetto non espone intenzionalmente questi servizi in LAN durante una partita.

## Artefatti finali

Lo script `npm run build:android` produce `artifacts/open-codenames-preview.apk` e stampa SHA-256. La variante di questa consegna comprende ARM64 e x86_64; ARMv7 è disponibile nello script ma non è stato compilato nel primo collaudo. La firma di prova non è una chiave di pubblicazione. Per distribuire aggiornamenti mantenere la stessa propria chiave e seguire il README.

SHA-256 della prima consegna 0.1.0: `0919d38cc902121dac2696097eadc7fded545d3c9dfe6e3a8ccda7815b515402`. Sorgenti nel repository locale dedicato; nessuna modifica al progetto Open Taboo e nessuna pubblicazione remota.

## Aggiornamento UI 0.1.1 — 22 ottobre 2026

Nuova palette indaco/lime/corallo/blu, Home con illustrazione vettoriale animata e azioni illustrate, icone di collegamento, avatar con presenza in lobby, pannello indizio sfumato, contatori di squadra con barre e carte ridisegnate. Transizioni di pagina e feedback visivi con driver nativo; animazioni disabilitate con l’impostazione Android “Riduci animazioni” e illustrazione ferma in background. Componenti grafici separati in `src/ui/visuals.tsx`; nessuna nuova dipendenza, nessun contenuto da scaricare. Motore, protocollo, filtri dei segreti e trasporti non modificati.

Typecheck, 29 test e controllo Prettier superati. Build release ARM64/x86_64 riuscita, incluse le verifiche native già disponibili. Versione Android `0.1.1`, versionCode `2`, firma di collaudo compatibile con l’APK precedente. Log: `artifacts/build-ui-refresh.log`. Le verifiche radio fisiche sopra elencate rimangono pendenti.

Installazione e avvio dell’APK aggiornato verificati su emulatore API 36. Controllati Home, scelta del collegamento e recupero del tabellone salvato. L’albero accessibile espone tutte e 25 le carte e conferma cinque colonne. Corretto durante l’ispezione un ritaglio delle sfumature dovuto al padding del contenitore SVG Android. Nessun errore ReactNativeJS nei controlli. Immagini effettive in `artifacts/screenshots/ui-refresh/`; non sono mockup. L’emulatore ha nuovamente mostrato un ANR della UI di sistema durante il suo avvio, chiuso prima del collaudo dell’app.

APK aggiornato: `artifacts/open-codenames-preview.apk`, SHA-256 `ada579f1670ab00d640bc1831d45c88250fb832a3d370fa4de688444d0acfeef`. `artifacts/SHA256SUMS` e l’archivio dei sorgenti sono aggiornati insieme alla consegna.

## Logo e capacità 0.2.0 — 22 ottobre 2026

Nuovo logo originale condiviso da header e icone Android normale/adattiva; generazione SVG/PNG riproducibile con resvg, escluso dal runtime. Limiti centralizzati in `config/session-limits.json`: dieci giocatori, sette socket Bluetooth diretti, nove socket LAN, due figli per ponte. UI con scoperta dei ponti, selezione manuale host/ponte, conferma impronta, approvazione host e comandi di attivazione/recupero del ponte anche dalla diagnostica.

Typecheck e **40 test TypeScript** superati: suite motore/protocollo/runtime più suite tunnel e relay. Copertura aggiuntiva: dieci persone con sette dirette e due virtuali cifrate, mappe dei due suggeritori e filtro del gateway indovinatore, nessun token del figlio nei messaggi in chiaro al ponte, isolamento dei percorsi, rifiuto di ponti anonimi/annidati, massimo due figli, chiusura a cascata, ripristino dei listener, rientro di un figlio durante la partita con nuovo percorso e chiave effimera senza seconda approvazione o persona duplicata, pin persistito, chiave cambiata, conferma prima delle credenziali, UTF-8, manomissioni, replay, riflessioni e riordino. I test sostituiscono I/O nativo nel processo di test e non sono una prova radio.

Build release ARM64/x86_64 riuscita con **4 test JVM**, versione `0.2.0`, versionCode `3`, firma di collaudo compatibile con la precedente. Log: `artifacts/build-logo-relay.log`. Installazione e avvio verificati su emulatore API 36; nuovo logo e limiti visibili nelle schermate effettive `artifacts/screenshots/logo-relay/`.

**Capacità LAN osservata nell’APK:** un host Android e nove client Node su socket TCP nativi mediante adb forward, nove approvazioni nella UI, dieci presenze simultanee a versione 10 e snapshot filtrati correttamente. Una decima connessione remota è stata chiusa dal limite nativo. Script ripetibile `node scripts/lan-smoke.cjs IPv4 porta codice 9`. Questo verifica il listener Android e l’autorità, non dieci telefoni o un hotspot fisico.

**Instradamento cifrato osservato nell’APK:** seconda stanza con sette client TCP di collaudo e due sessioni virtuali attraverso il primo client. I due tunnel usano la stessa classe `SecureTunnel` del progetto sul lato Node e l’implementazione Hermes effettiva nell’APK sul lato host. Host approva tutte e nove le persone; dieci presenze simultanee, ECO da tutti inclusi i due tunnel, configurazione di entrambi i suggeritori sulle sessioni cifrate, avvio dalla UI Android e indizio cifrato accettato. Entrambi i suggeritori ricevono 25 colori, i sette indovinatori diretti zero colori coperti. Script `scripts/relay-smoke.cjs`. I collegamenti fisici di questo test sono TCP: non si tratta di una verifica del controller, dei listener ponte RFCOMM o della scoperta Bluetooth su hardware.

APK 0.2.0 finale: `artifacts/open-codenames-preview.apk`, SHA-256 `8e0de1fb25c46fe8f045eeda112b52d7310040caef7726f0f4ce7d4ac13f8878`, circa 50 MiB. Firma verificata con apksigner, package/versione/min SDK/target verificati con aapt. Sorgenti aggiornati in `artifacts/open-codenames-source.zip`; nessuna pubblicazione remota.

## Revisione dopo il playtest — 0.3.0

Richieste applicate: etichetta OFFLINE eliminata dall’intestazione; squadra e ruolo personali visibili anche scorrendo la partita; carte scoperte nettamente più scure e marcate SCOPERTA; pallino inizialmente bianco e poi del team che ha confermato la scelta, distinto dal colore della parola. In lobby: un posto suggeritore per squadra, occupazione visibile/disabilitata, suggeritore sopra gli indovinatori, ingressi alternati rosso/blu e shuffle autorizzato solo all’host, bilanciato e con pronti azzerati.

Timer facoltativo alla creazione (30/60/90/120/180 secondi, disattivato di default), comprende indizio e scelte e passa automaticamente il turno alla scadenza. Orologio autorevole host, offset visivo dei client, serializzazione con i comandi e commit prima del broadcast. Host in background conserva il residuo; vecchie stanze caricate senza timer. Registro limitato agli ultimi 100 eventi per evitare crescita dei frame in partite lasciate scadere ripetutamente.

I non host possono bloccare il telefono o cambiare app senza fermare gli altri; al ritorno recuperano lo snapshot attuale prima di poter agire. Ciclo di vita serializzato, connessioni superate scartate e nessun replay di comandi pendenti. Il client approvato conserva anche l’intenzione di rientro dopo ricreazione del processo; Lascia stanza o la scelta di ospitare la disattivano. L’host deve rimanere in primo piano; un ponte sospeso interrompe temporaneamente anche i propri figli.

**52 test TypeScript** e typecheck superati. Copertura aggiunta: associazione del pallino al team attore anche dopo un errore/cambio turno, proiezione dei soli dati pubblici, alternanza persistita dopo rimozione/recupero, shuffle 4–10 persone e vincoli dei ruoli, assenza client senza blocco globale, sincronizzazione al rientro con comandi disabilitati, offset degli orologi, rientro dopo ricreazione del processo e uscita esplicita, timer in entrambe le fasi, azione concorrente alla scadenza, errore di persistenza, pausa/ripresa del residuo, recupero dopo arresto improvviso, migrazione delle stanze e 500 scadenze consecutive mantenendo lo snapshot entro i limiti del tunnel.

**Interazione Android effettiva, emulatore API 36:**

- Nuova Home senza etichetta OFFLINE, creazione con timer disattivato/attivato e scelta di 30 secondi. Lobby con richieste native TCP, squadre iniziali alternate, shuffle dalla UI, suggeritori in testa e posto occupato non selezionabile.
- Host nell’APK e tre client Node attraverso socket Android: partita da quattro avviata dalla UI, conto alla rovescia e scadenze automatiche osservate da v13 a v19 con snapshot filtrati a tutti i client. Questa prova verifica il timer dentro Hermes e il broadcast nativo.
- Prova separata con **client nell’APK** e host di collaudo Node basato sull’autorità del progetto, raggiunto via `10.0.2.2`. Dopo il blocco schermo Android, la partita è avanzata mentre il client era scollegato (v19, due carte scoperte); al risveglio hello/resume automatico e snapshot v20 con entrambe le carte. Ripetuta Home/cambio app: avanzamento a v23 con tre carte, rientro automatico a v24. Nessun comando Android ritrasmesso. Albero accessibile e screenshot confermano carte scure e pallini blu/rossi delle squadre che le hanno scelte. Script ripetibile `scripts/client-lifecycle-smoke.cjs`.
- Nessun errore ReactNativeJS/AndroidRuntime nei controlli. Un dump uiautomator non ha raggiunto lo stato idle durante l’aggiornamento continuo del timer; il controllo visivo è stato eseguito con screenshot e i cambi di versione sono stati osservati dai socket. Non è stato conteggiato come dump riuscito.

Immagini effettive in `artifacts/screenshots/playtest/`. Le prove interattive sono state eseguite sulla prima build 0.3.0; la consegna finale include inoltre il ritorno all’inizio della schermata all’avvio/fine missione e le protezioni aggiuntive coperte dai test. Queste verifiche non sostituiscono la regressione Bluetooth sui telefoni del playtest; procedura aggiornata in `DEVICE_TEST.md`.

Consegna 0.3.0: build release ARM64/x86_64 completata, versionCode `4`, 52 test applicativi e 4 test JVM superati; controllo Prettier e typecheck superati. Log finale `artifacts/build-playtest-0.3.0.log`. SHA-256 APK `8111daf2fdcd8408fcc5df8a30fa3716f3499b578c62ba0214a423c4f5f07b86`. Firma e metadati verificati; installazione dell’APK finale riuscita, Home caricata senza etichetta OFFLINE e nessun errore ReactNativeJS/AndroidRuntime osservato. Artefatti `open-codenames-preview.apk`, `open-codenames-source.zip` e `SHA256SUMS` aggiornati insieme; nessuna pubblicazione remota.

## Ricerca Bluetooth — 0.3.1, 23 ottobre 2026

Segnalazione dell’utente: dopo aver reso visibile l’host, solo uno di tre telefoni lo trovava; il gruppo ha giocato via hotspot. Modelli, versioni Android e risultati della ricerca nelle impostazioni non disponibili. Non attribuiamo una causa certa ai dispositivi: nel codice precedente è stato individuato un filtro che rendeva invisibili i candidati quando Android non restituiva gli UUID del gioco, oltre a richieste SDP avviate durante inquiry.

Correzione: candidati Classic/dual-mode visibili subito, inclusi i già associati; etichette distinte tra servizio riconosciuto e non verificato, senza promozione basata sul nome. Tentativo esplicito di collegamento all’host o al ponte anche senza riconoscimento SDP. Servizi verificati dopo inquiry con coda seriale, priorità telefoni, watchdog e budget limitati; interruzione e nuova ricerca cancellano la coda. UUID assenti non eliminano il candidato. SDP dalla cache o tardivo può aggiornare l’etichetta e non garantisce una stanza aperta. RFCOMM sicuro, UUID del gioco, approvazione host e verifica dell’impronta attraverso il ponte restano applicati.

Verifiche eseguite sulla consegna 0.3.1:

- **57 test TypeScript** superati e typecheck senza errori. Nuovi controlli: candidato senza UUID, promozione senza duplicati/declassamento, metadati di associazione, ruoli host/ponte sullo stesso MAC, ordinamento, eventi di fine/verifica tardiva, interruzione e reset nuova ricerca.
- **9 test JVM** superati (5 coda discovery, 4 codec), zero errori/fallimenti negli XML. Coda: inquiry prima di SDP, priorità/deduplicazione, risposta estranea o tardiva, timeout singolo e totale, watchdog inquiry, cancellazione/ripartenza, limite di 64 candidati.
- Build release ARM64/x86_64 completata con bundle incorporato e lint vital, log `artifacts/build-bluetooth-discovery-0.3.1.log`; controllo Prettier superato. Firma verificata con apksigner e metadati con aapt: `org.opencodenames.app`, versione `0.3.1`, versionCode `5`, min SDK 24, target 36, stessa firma debug di collaudo.
- SHA-256 APK: `d55999d6204e5a9f932a35fd998181ea984ee6a878c3278cede55b84f08b551f`.

Non sono stati collegati telefoni fisici né eseguita una nuova interazione su emulatore per questa revisione. Compilazione e test verificano la gestione della ricerca, non il rilevamento radio sui tre telefoni del playtest. Regressione da eseguire in `DEVICE_TEST.md`, sezione 8. APK e sorgenti locali aggiornati; nessuna pubblicazione remota.

## Compatibilità fra versioni — 0.3.2, 23 ottobre 2026

Richiesta applicata: impedire partite fra versioni diverse dell’app. La versione esatta in `package.json` viene trasmessa in ogni busta e verificata prima di accettarne il contenuto, anche attraverso il ponte e nei messaggi cifrati interni. Mancanza del campo nelle build precedenti equivale a incompatibilità. Il controllo riguarda Bluetooth, LAN/hotspot, ingressi nuovi e rientri con credenziali valide; la versione dello stato di partita resta indipendente. La versione Android e quella mostrata in ingresso/diagnostica provengono dallo stesso sorgente.

L’host rifiuta e chiude il collegamento incompatibile prima di creare una richiesta o ripristinare una presenza. Il client mostra versione locale e remota se riconoscibile, non applica snapshot e interrompe i tentativi automatici, anche al rientro dal background. Un nuovo ingresso esplicito rivaluta la compatibilità. I file locali delle stanze non vengono cancellati; tutti i telefoni devono aggiornarsi prima del recupero.

**66 test TypeScript**, typecheck e Prettier superati. Le nove nuove prove coprono uguaglianza esatta, patch precedenti/future/campo assente o malformato, incompatibilità anche con protocollo futuro, rifiuto prima dell’approvazione in entrambi i trasporti, rientro con credenziali valide ma versione diversa, client verso host precedente/successivo senza retry da timer o ritorno in app, ripartenza dopo ingresso esplicito, rifiuto del figlio sul ponte e controllo del messaggio interno cifrato sull’host. Le suite continuano a coprire le connessioni compatibili e dieci sessioni attraverso il ponte. Controllo sintattico Node dei tre script di collaudo superato; script aggiornati con la versione corrente.

Il collaudo radio fra APK differenti sui telefoni rimane da eseguire (`DEVICE_TEST.md`, sezione 9). Nessuna nuova interazione su emulatore o dispositivo fisico è stata eseguita per questa revisione. Una vecchia build può mostrare il proprio messaggio generico anziché il nuovo dettaglio quando interrompe un tunnel incompatibile; la nuova build blocca comunque lo scambio.

Consegna 0.3.2: build release ARM64/x86_64 completata con lint vital e **9 test JVM** superati, log `artifacts/build-version-gate-0.3.2.log`. Firma verificata con apksigner (stessa firma debug di collaudo); aapt conferma versione `0.3.2`, versionCode `6`, min SDK 24 e target 36. La sourcemap del bundle è stata confrontata con il sorgente finale del controllo versioni. SHA-256 APK: `5f9e7ea7fd28858573705fcd6fd82788afd7ebdb679fa1a0bd8aca0e306b0b71`. APK, sorgenti ZIP e `SHA256SUMS` aggiornati localmente, senza pubblicazioni remote.

## Home by Gleetch — 0.3.3, 23 ottobre 2026

Intestazione Home: **by Gleetch** sotto Open Codenames, pulsante quadrato 44 × 44 con ingranaggio vettoriale in alto a destra, etichetta accessibile Impostazioni e feedback alla pressione. Rimosso il precedente pulsante Impostazioni dal fondo; Regole occupa la propria riga. Titolo adattabile allo spazio disponibile. Nessun nuovo test per il solo spostamento grafico; il dato di test sulla versione incompatibile è stato reso indipendente dalla prossima patch per consentire gli aggiornamenti successivi.

Typecheck, Prettier, **66 test applicativi e 9 JVM** superati. Build release ARM64/x86_64 con lint vital completata, log `artifacts/build-home-gleetch-0.3.3.log`; firma APK e metadati verificati, versione `0.3.3`, versionCode `7`, min SDK 24 e target 36. SHA-256: `8a1ba2f0c6e2f1bcf7043df7a2471d9cb8bd0e2ba78eba38fd1b9ca62e3a0be3`.

Verifica effettiva nell’emulatore Android API 36: installazione riuscita, ispezione visiva della Home, firma sotto il titolo e ingranaggio sulla destra; pressione dell’ingranaggio apre Preferenze e Indietro riporta alla Home. Albero accessibile conferma un solo pulsante Impostazioni. Screenshot e dump in `artifacts/screenshots/home-gleetch/`. Nessun errore ReactNativeJS/AndroidRuntime nei log filtrati. Emulatore di collaudo chiuso al termine. APK e sorgenti locali aggiornati; resta necessario usare la stessa versione su tutti i telefoni.

## Etichette canale e Home — 0.3.4, 23 ottobre 2026

Rimossa l’etichetta CONSIGLIATO dal canale Bluetooth, insieme allo stile rimasto inutilizzato. La Home indica **4–10 dispositivi** al posto di 4–10 persone. Nessun nuovo test per le due modifiche di testo. Typecheck, Prettier, 66 test applicativi e 9 JVM superati; build release ARM64/x86_64 con lint vital completata, log `artifacts/build-ui-labels-0.3.4.log`. Il sorgente App.tsx della sourcemap è stato confrontato con il file finale, confermando entrambe le modifiche nel bundle. Firma APK verificata; aapt conferma versione `0.3.4`, versionCode `8`, min SDK 24 e target 36. SHA-256 APK: `ea632ed225538451bcd3a6ffeafa0f65ded12fdc710c4d527fa2364ef9c80a3a`. Nessuna nuova interazione su emulatore per questa revisione. APK e archivio sorgenti aggiornati localmente; tutti i telefoni devono usare la stessa versione.

## Modalità Condivisa e Decifratore — 0.4.0, 23 ottobre 2026

Creazione con scelta Classica (predefinita, minimo quattro dispositivi) o Condivisa (minimo due). In Condivisa c’è esattamente un dispositivo per i suggeritori e almeno uno per i decifratori, senza squadra fissa o shuffle dei telefoni. Host inizialmente suggeritori, nuovi ingressi decifratori, ruoli riassegnabili solo in lobby. Nome del ruolo aggiornato a **Decifratore/Decifratori** in UI, intestazione, lobby, messaggi e regole; identificatore interno `guesser` conservato. Home aggiornata a 2–10 dispositivi.

All’avvio e a ogni cambio turno: passaggio del telefono con conferma, contatore turno persistito e verifica autorevole. Prima della conferma lo snapshot del suggeritore non contiene colori coperti, quello del decifratore non li contiene mai. Più dispositivi possono confermare simultaneamente lo stesso turno; una conferma del turno precedente non sblocca quello nuovo. Proiezione della mappa solo dopo commit; ruoli e regole delle carte invariati. Timer facoltativo comprende il passaggio; nuova missione, scadenza e rientro richiedono la conferma del turno corrente quando manca. Durante sincronizzazione la UI condivisa nasconde il tabellone precedente. Le vecchie stanze sono migrate a Classica.

**78 test TypeScript e 9 JVM** superati, typecheck e Prettier superati. Nuove prove: composizione 2–10, suggeritore unico fra entrambe le squadre, cambio ruolo solo in lobby, proiezioni prima/dopo conferma, azioni delle stesse sessioni per entrambe le squadre e pallino corretto, conferme indipendenti, scadenza/turno obsoleto, nuova missione, protocollo handoff, concorrenza fra conferme, rientro e migrazione, rollback su fallimento di persistenza. Integrazione runtime con I/O sostituito nei test: avvio con due sessioni, filtro mappa, comandi bloccati prima del passaggio, cambio turno e rientro nella stessa identità.

**Prova effettiva Android API 36 con host nell’APK e un client Node via socket TCP Android reale:**

- Selezione Condivisa in creazione e lobby con un solo posto Suggeritori e uno Decifratori; ruoli del dispositivo visibili e possibilità di avvio con due sessioni pronte.
- Missione avviata v4, primo passaggio ai rossi senza tabellone. Conferme del client e dell’host v5–v6; mappa effettivamente visibile sul telefono suggeritori dopo la conferma, con 25 carte e colori nell’albero accessibile.
- Indizio inviato dalla UI Android (v7), carta neutrale scelta dal client (v8): cambio ai blu, nuovo passaggio, mappa nuovamente nascosta e ritorno all’inizio della schermata. Il client controlla il filtro dei colori su ogni snapshot e non riceve colori coperti.
- Distacco/rientro del client: stessa sessione, due presenze, turno attuale v10. Screenshot/dump in `artifacts/screenshots/shared/`; script `scripts/lan-smoke.cjs` aggiornato con configure condivisa, handoff, scelta carta e cambio ruolo per il collaudo.
- Emulatore: avviso di mancata risposta della UI di sistema durante avvio, superato con Wait. Alcuni dump uiautomator hanno fallito durante transizioni; scartati e ripetuti, senza contarli come verifiche riuscite. Nome inserito da ADB troncato dalla sequenza di digitazione dell’emulatore, senza effetto su ruolo/sessione. Nessun errore ReactNativeJS/AndroidRuntime nei log filtrati. Client, inoltro porta e processi dell’emulatore chiusi al termine.

Questa è una prova di due sessioni logiche, una nell’APK e una Node, non di due telefoni fisici o radio Bluetooth. La regressione su telefoni è in `DEVICE_TEST.md`, sezione 10. Non è stata eseguita una nuova prova interattiva del client Android Decifratore per questa revisione; i controlli del relativo flusso sono coperti dalle suite del motore/runtime e dalla compilazione.

Consegna: release ARM64/x86_64 con lint vital, log `artifacts/build-shared-0.4.0.log`. Firma verificata, aapt conferma `0.4.0`, versionCode `9`, min SDK 24 e target 36. UI, motore e autorità della sourcemap confrontati con i sorgenti finali. SHA-256 APK `8124591f4393d03a8f10bf89384b6ab5ae15f88859c4f45fe424daea15dacaae`. APK e archivio sorgenti aggiornati localmente; nessuna pubblicazione remota. Usare 0.4.0 su tutti i telefoni.

## Canale, versione e grammatica — 0.4.1, 23 ottobre 2026

Campo nickname/nome dispositivo spostato sopra la scelta Bluetooth/Wi-Fi, sia in creazione sia in ingresso. Rimosso dal canale il testo sulla versione e sull’obbligo di uguaglianza; nelle impostazioni compare **Versione 0.4.1**, derivata dalla versione effettiva del pacchetto. Rimossa la vecchia etichetta fissa Versione 0.1.1 dal riquadro Italiano; versione tecnica conservata in diagnostica. Corretti gli articoli rimasti dopo la rinomina del ruolo: “ai decifratori” e “i decifratori” in app, regole e documentazione corrente.

Controllati ordine del campo, assenza del testo versione nel canale, presenza della versione dinamica nelle impostazioni e combinazioni errate di articoli/preposizioni con decifratore/decifratori. Nessun nuovo test per il riordino e le correzioni di testo. Typecheck, Prettier, **78 test applicativi e 9 JVM** superati; build release ARM64/x86_64 con lint vital completata, log `artifacts/build-channel-settings-0.4.1.log`. UI e istruzioni della sourcemap confrontate con i sorgenti finali. Firma APK verificata e aapt conferma versione `0.4.1`, versionCode `10`, min SDK 24 e target 36. SHA-256 APK: `3cbfcd750835784d33546c32a6cb6a61ebbd1fe724539869064badaf010d3da8`. Nessuna nuova interazione su emulatore per questa revisione. APK e sorgenti locali aggiornati insieme; usare la stessa versione su tutti i telefoni.

## Single device — 0.5.0, 23 ottobre 2026

Terza modalità alla creazione: un solo telefono passa fra suggeritori e decifratori di entrambe le squadre. Nome facoltativo, avvio con una sola sessione pronta automaticamente, assegnazioni personali/shuffle/inviti assenti. `mode:local` salta listener, discovery, tunnel e permessi Bluetooth; gli ingressi aggiuntivi sono rifiutati. Home aggiornata a 1–10 dispositivi, modalità scelta prima dei canali, collegamenti nascosti in Single device. Il pulsante di recupero nella Home è **Riprendi la tua partita**.

Ruolo effettivo derivato dalla fase; conferma legata sia a turno sia a fase. Il suggeritore confermato vede la mappa, l’invio dell’indizio la nasconde immediatamente e richiede un nuovo passaggio ai decifratori della stessa squadra. Questi ricevono solo i colori delle carte scoperte. Al cambio turno si passa al suggeritore avversario; conferme di fasi/turni vecchi non sbloccano lo stato corrente. Recupero e pausa cancellano le conferme conservando la partita; timer facoltativo con residuo salvato e passaggi inclusi. Nessun colore coperto rivelato nel risultato finale Single device.

**87 test applicativi e 9 JVM** superati, typecheck e Prettier superati. Nuove prove: singolo dispositivo, ruoli automatici e invarianti lobby, mappa prima/dopo conferma e subito dopo l’indizio, rifiuto conferme della vecchia fase nello stesso turno, alternanza dei ruoli/squadre e pallini, scelte riservate alla fase giusta, assassino e risultato senza mappa, scadenza/nuova missione, validazione fase nel protocollo, mancata persistenza senza sblocco, recupero e rifiuto ingressi. Runtime con I/O sostituito: zero aperture/connessioni native, zero richieste di permessi e zero messaggi di rete anche alla ripresa, chiusura eventi socket tardivi, pausa e riapertura con mappa nuovamente mascherata. Le suite Classica/Condivisa continuano a passare.

**Prova effettiva dell’APK nell’emulatore Android API 36:**

- Bluetooth e Wi-Fi disabilitati via comandi Android, valori `bluetooth_on=0` e `wifi_on=0`; installazione/avvio riusciti, scelta Single device, nome lasciato vuoto, nessun dialogo per permessi vicini, lobby 1/1 e avvio senza altri dispositivi o socket di collaudo.
- Prima squadra blu, conferma del suggeritore, 25 colori nella mappa verificati nell’albero accessibile. Indizio inviato con **Nascondi mappa e passa ai decifratori**: nuova schermata di passaggio della stessa squadra senza tabellone. Dopo conferma decifratori, 25 carte pubbliche e nessun colore coperto nell’albero accessibile.
- Scelta di una neutrale dalla UI e conferma nativa: nuovo passaggio al suggeritore rosso, mappa nascosta. **Salva ed esci**, arresto/riapertura del processo e **Riprendi la tua partita**: stessa fase/squadra, nuova conferma obbligatoria, stessa carta scoperta e pallino blu dopo lo sblocco della mappa.
- Screenshot e dump in `artifacts/screenshots/single/`; nessun errore ReactNativeJS/AndroidRuntime nei log filtrati. Emulatore chiuso al termine. La prova non attesta il dispositivo fisico, i dati mobili spenti o una nuova regressione radio multiplayer; procedura sul telefono in `DEVICE_TEST.md`, sezione 11.

Build release ARM64/x86_64 e lint vital completati, log `artifacts/build-single-0.5.0.log`; firma verificata, versione `0.5.0`, versionCode `11`, min SDK 24 e target 36. Sorgenti UI, motore, autorità, runtime e regole della sourcemap confrontati con i file finali. SHA-256 APK: `41300d7bc30e0d196a2f32e645b0295dee56b8134fc4a1f62d5478653c752918`. APK e ZIP sorgenti aggiornati localmente, senza pubblicazione remota.

## Canale prima di Ospita/Entra — 0.5.1, 23 ottobre 2026

Home con pulsante **Gioca**, seguito dalla scelta **Bluetooth / Wi-Fi / hotspot / Single device**. I due canali multiplayer aprono una pagina dedicata **Ospita partita / Entra in partita**, poi il modulo appropriato al canale scelto. Single device salta questa scelta e apre direttamente nome facoltativo e timer. Classica/Condivisa restano opzioni della sola preparazione host multiplayer. Il tasto Indietro segue i passaggi; passando da Single device a un canale multiplayer viene ripristinata Classica. Cambiando canale multiplayer vengono azzerati indirizzo, codice e scelta ponte manuale. I pulsanti di ripresa restano nella Home e il runtime recupera il canale salvato.

Typecheck, Prettier, **87 test applicativi e 9 JVM** superati. Build release ARM64/x86_64 con lint vital completata, log `artifacts/build-channel-first-0.5.1.log`; firma verificata, versione `0.5.1`, versionCode `12`, min SDK 24 e target 36. Il sorgente App.tsx contenuto nella sourcemap corrisponde al file finale. SHA-256 APK: `0bc30918436ca45290c92648258cf23505a5ced316249cd34c898b7023326496`.

**Prova effettiva dell’APK nell’emulatore Android API 36:**

- Home → Gioca → tre canali; Bluetooth e Wi-Fi/hotspot → Ospita/Entra → rispettivi moduli nickname, senza ripetere la scelta del canale. Classica e Condivisa selezionabili solo nella preparazione host.
- Indietro dal modulo a Ospita/Entra e da lì ai canali. Single device apre subito la preparazione, senza Ospita/Entra o selettore Classica/Condivisa. Tornando ai canali e scegliendo Bluetooth si ripristinano Ospita/Entra e Classica.
- Single device con nome vuoto, Bluetooth e Wi-Fi spenti (`bluetooth_on=0`, `wifi_on=0`): lobby 1/1 e avvio missione fino al passaggio al suggeritore rosso, senza dialoghi Bluetooth.
- Screenshot e dump in `artifacts/screenshots/entry/`; nessun errore ReactNativeJS/AndroidRuntime nei log filtrati (`artifacts/entry-0.5.1-errors.log`). Questa revisione non include nuovi ingressi di rete o prove radio fra dispositivi fisici; la procedura completa è in `DEVICE_TEST.md`, sezione 12. APK e ZIP sorgenti aggiornati localmente.

## Grafica canali e Home — 0.5.2, 23 ottobre 2026

Wi-Fi / hotspot precede Bluetooth, poi Single device. Tutte le tre scelte usano lo stesso gradiente viola con icone blu. Le didascalie mostrano rispettivamente **Dispositivi 2–10**, **Dispositivi 2–8** e **1 dispositivo** su una riga dedicata, seguita dalla descrizione del canale. I massimi multiplayer derivano dalle costanti condivise: Bluetooth mostra la capacità diretta, mentre il ponte sperimentale fino a dieci rimane disponibile nei percorsi esistenti. La Home mostra **Senza account** al posto di 1–10 dispositivi; il sottotitolo Gioca segue il nuovo ordine Wi-Fi, Bluetooth, telefono singolo.

Typecheck, Prettier, **87 test applicativi e 9 JVM** superati. Build release ARM64/x86_64 e lint vital completati, log `artifacts/build-channel-design-0.5.2.log`. Firma verificata; versione `0.5.2`, versionCode `13`, min SDK 24, target 36. App.tsx nella sourcemap coincide con il sorgente finale. SHA-256 APK: `f78702f465d5a77a5f800b125055aa33246d5d966b0d2b7fab9542eeb1711909`.

APK installato e aperto nell’emulatore Android API 36: controllati visivamente Home e selezione canale, ordine e colore uniforme dei tre pulsanti, conteggi e descrizioni senza tagli. Screenshot/dump in `artifacts/screenshots/channel-design/`; nessun errore ReactNativeJS/AndroidRuntime nel log filtrato `artifacts/channel-design-0.5.2-errors.log`. Nessuna nuova prova radio o di partita per questa revisione grafica. APK e archivio sorgenti aggiornati localmente.

## Unico dispositivo senza nome — 0.5.3, 23 ottobre 2026

Rinominata la modalità in **Unico dispositivo** in selezione canali, intestazioni, lobby, partita, stato, messaggi, diagnostica e regole. Il codice interno `single` resta invariato. Il campo nome è rimosso dalla preparazione locale: restano timer facoltativo e pulsante per preparare la partita. La creazione locale usa automaticamente il nome interno Unico dispositivo, anche quando era stato digitato un nickname per il multiplayer. Nome/nickname resta richiesto nei moduli Bluetooth e Wi-Fi/hotspot. Aggiornate istruzioni e documentazione corrente; i verbali delle versioni precedenti conservano i testi storici.

Typecheck, Prettier, **87 test applicativi e 9 JVM** superati. Build release ARM64/x86_64 e lint vital completati, log `artifacts/build-unico-dispositivo-0.5.3.log`; firma verificata, versione `0.5.3`, versionCode `14`, min SDK 24 e target 36. UI, regole, motore, autorità e runtime nella sourcemap corrispondono ai sorgenti finali. SHA-256 APK: `54f951be2789b64c897edf0c4ef64c2e0224b211b7185d68d096519ebff88375`.

APK installato nell’emulatore Android API 36: verificata la nuova dicitura nel canale; modulo host Wi-Fi con campo nickname presente; ritorno ai canali e preparazione Unico dispositivo con nessun campo di testo. Controllati visivamente preparazione e lobby; avvio con Bluetooth/Wi-Fi spenti (`bluetooth_on=0`, `wifi_on=0`), lobby 1/1 e passaggio al suggeritore rosso senza inserire alcun nome. Screenshot/dump in `artifacts/screenshots/unico/`; nessun errore ReactNativeJS/AndroidRuntime nel log filtrato `artifacts/unico-0.5.3-errors.log`. Nessuna nuova prova radio fra telefoni fisici. APK e archivio sorgenti aggiornati localmente.

## Etichetta Gestione partita — 0.5.4, 23 ottobre 2026

Rinominata l’etichetta sopra Classica/Condivisa in **GESTIONE PARTITA**, con intestazione corrispondente nel README. Typecheck, Prettier, **87 test applicativi e 9 JVM** superati. Build release ARM64/x86_64 con lint vital completata, log `artifacts/build-gestione-partita-0.5.4.log`; firma verificata, versione `0.5.4`, versionCode `15`, min SDK 24 e target 36. App.tsx nella sourcemap coincide con il sorgente finale e contiene la nuova etichetta. Nessuna nuova prova su emulatore per questa sola correzione di testo. SHA-256 APK: `c71af22a1b7669bcf41116fd29078eab45a60bd80ce9ba21915c3e78d8ab4343`. APK e archivio sorgenti aggiornati localmente.

## Cinque lingue — 0.6.0, 23 ottobre 2026

Aggiunti inglese, spagnolo, tedesco e francese, mantenendo italiano come lingua iniziale. Nella Home un pulsante quadrato con globo precede l’ingranaggio; il selettore mostra i nomi nativi delle cinque lingue e la selezione corrente. Preferenza salvata localmente. Interfaccia, ruoli, carte, accessibilità, conferme, regole, impostazioni e messaggi di sistema tradotti offline. Catalogo di 499 messaggi; controllate 356 chiamate UI rispetto al catalogo, con quattro traduzioni non vuote e segnaposto invariati per ciascuna voce. Il testo di giocatori, indizi e parole non passa attraverso una traduzione automatica. Il registro preserva anche soprannomi uguali ai prefissi dei messaggi di sistema; formati dinamici di rete riconosciuti attraverso una lista esplicita.

Mazzi originali inclusi: italiano 1022 parole, inglese 588, spagnolo 574, tedesco 580, francese 576. La lingua della preferenza host alla creazione determina `Game.language`, salvato e proiettato; tutte le sessioni ricevono le medesime parole. L’interfaccia di ciascun client resta locale. Cambiare preferenza o riprendere una partita non cambia il mazzo, neppure nelle successive missioni della stessa stanza. Vecchi salvataggi senza lingua migrati a italiano conservando le carte. Normalizzazione degli indizi indipendente dall’interfaccia, incluse equivalenze ß/SS e œ/oe.

**99 test applicativi e 9 JVM** superati, typecheck e Prettier superati. Le prove nuove coprono integrità di tutti i cataloghi, parametri utente preservati, messaggi dinamici e registro, almeno 500 voci NFC senza duplicati normalizzati in ciascuna lingua, 20 tabelloni per lingua con invarianti 25/9/8/7/1, riservatezza della proiezione, lingua delle nuove missioni, ripresa e migrazione, preferenza salvata e mazzo invariato dopo cambio UI, indizi con varianti tedesche/francesi. Le suite Classica, Condivisa, Unico dispositivo e rete continuano a passare.

**Prove effettive nell’emulatore Android API 36:**

- Home italiana con globo quadrato immediatamente a sinistra dell’ingranaggio; selettore con Italiano, English, Español, Deutsch, Français. Verificati cambio immediato, selezione evidenziata, Home e canali in tutte e quattro le nuove lingue. Controllati visivamente anche testi più lunghi in tedesco e francese.
- Partita Unico dispositivo inglese senza nome, radio spente: lobby con Word language: English, avvio, conferma suggeritore e tabellone inglese con ruoli/colori/accessibilità inglesi. Salvataggio tramite conferma nativa tradotta.
- Cambio UI in francese, arresto/riapertura del processo: scelta conservata. Ripresa della partita inglese con nuovo passaggio obbligatorio; UI francese e parole inglesi. Nell’APK definitivo confrontate le 20 carte visibili nei dump prima/dopo: identiche. I test applicativi controllano il tabellone completo salvato.
- Impostazioni francesi con versione 0.6.0, preferenze tradotte e 576 parole incluse; regole francesi visualizzate. Nuova partita nell’APK definitivo: lobby Langue des mots : Français, conferma e tabellone francese con accenti, colori e ruoli tradotti. Bluetooth/Wi-Fi risultano entrambi spenti (`bluetooth_on=0`, `wifi_on=0`).
- Screenshot/dump in `artifacts/screenshots/languages/`; nessun errore ReactNativeJS/AndroidRuntime nel log filtrato del collaudo finale `artifacts/languages-0.6.0-errors.log`. Nessuna nuova prova radio fra telefoni fisici o revisione editoriale indipendente da madrelingua: procedura in DEVICE_TEST.md, sezione 13.

Build release ARM64/x86_64 e lint vital completati; log definitivo `artifacts/build-languages-0.6.0-verified.log`. Firma verificata, versione `0.6.0`, versionCode `16`, min SDK 24 e target 36. UI, modello, motore, autorità, runtime, contenuti, catalogo e traduttore della sourcemap corrispondono ai sorgenti finali. SHA-256 APK: `76214a83aba9ada727e60552adb53db8b8093bb5aef31f9b61ca21013a0ada57`. APK e archivio sorgenti aggiornati localmente; stessa versione richiesta su tutti i dispositivi multiplayer.

## Bandiere lingua — 0.6.1, 23 ottobre 2026

Aggiunte bandiere accanto ai nomi nel selettore: Italia per Italiano, Regno Unito per English, Spagna per Español, Germania per Deutsch, Francia per Français. Il pulsante quadrato della Home a sinistra dell’ingranaggio mostra la bandiera della lingua corrente. Le bandierine sono SVG locali condivisi tra menu e pulsante, con proporzioni e bordi coerenti; nessuna dipendenza da emoji o risorse remote. Per l’accessibilità le figure sono decorative e il pulsante annuncia la lingua selezionata come valore testuale.

Typecheck, Prettier, **99 test applicativi e 9 JVM** superati. Build release ARM64/x86_64 con lint vital completata, log `artifacts/build-language-flags-0.6.1.log`; firma verificata, versione `0.6.1`, versionCode `17`, min SDK 24 e target 36. App.tsx e LanguageFlag.tsx nella sourcemap corrispondono ai sorgenti finali. SHA-256 APK: `bfef1e63b0cdc7b89de68ee9cf43544199b1fcf61bc7f24160b3375cfedc66a4`.

APK installato nell’emulatore Android API 36: controllati visivamente menu con tutte e cinque le bandiere e pulsante Home con bandiera inglese; cambiati italiano, inglese, spagnolo, tedesco e francese, con screenshot delle rispettive Home. Arresto/riavvio del processo: conservati francese e bandiera francese. Dump accessibile del pulsante: “Langue, Français”; le immagini decorative non introducono etichette duplicate. Screenshot/dump in `artifacts/screenshots/flags/`; nessun errore ReactNativeJS/AndroidRuntime nel log filtrato `artifacts/flags-0.6.1-errors.log`. APK e archivio sorgenti aggiornati localmente.

## Lingua di sistema al primo avvio — 0.6.2, 23 ottobre 2026

Aggiunta API sincrona nativa `systemLanguage()` che legge il tag della lingua Android da `Locale.getDefault().toLanguageTag()`, senza permessi o connessioni. Al primo avvio senza preferenza valida il codice principale viene normalizzato e salvato: it, en, es, de e fr riconosciuti anche con regioni o varianti; ogni altro codice e il rilevamento non disponibile usano inglese. La scelta salvata, automatica o manuale, prevale ai successivi avvii e cambi della lingua Android. Le preferenze precedenti senza lingua conservano suono e vibrazione; quelle illeggibili vengono recuperate con valori predefiniti e rilevamento. La Home attende il caricamento delle preferenze prima di apparire, per non mostrare temporaneamente una scelta diversa da quella salvata. Il recupero dei vecchi mazzi mantiene la migrazione a italiano e le parole esistenti.

Typecheck, Prettier, **119 test applicativi e 9 JVM** superati. Nuove prove per tag regionali e separatori, codici non supportati/vuoti, rilevamento e salvataggio di tutte le lingue supportate, ripiego su inglese, precedenza manuale e rilevamento già salvato, migrazione delle preferenze senza perdere suono/vibrazione, preferenze corrotte/API non disponibile, nessun avvio rete o richiesta di permessi per la lingua. Restano superate le prove sui salvataggi e mazzi multilingua.

**Prova effettiva nell’emulatore Android API 36, modificando la lingua principale nelle impostazioni Android:**

- Baseline en-US con preferenze azzerate: Home inglese.
- Sistema impostato e confermato es-US, verificato con `persist.sys.locale`: dati app di prova azzerati e nuovo avvio, Home spagnola con pulsante “Idioma, Español” e bandiera spagnola, senza passare dal selettore app.
- Scelto manualmente italiano nell’app, poi cambiato Android in pt-BR. Arresto/riapertura: italiano e bandiera italiana conservati.
- Con pt-BR principale e preferenze app nuovamente azzerate: Home inglese e bandiera britannica; le altre lingue nella lista preferita del sistema non sostituiscono il ripiego richiesto.
- Lingua principale del dispositivo virtuale ripristinata a en-US al termine. Screenshot/dump in `artifacts/screenshots/system-language/`; nessun errore ReactNativeJS/AndroidRuntime nel log filtrato `artifacts/system-language-0.6.2-errors.log`. Nessuna nuova prova radio fisica per questa modifica.

Build release ARM64/x86_64 e lint vital completati, log `artifacts/build-system-language-0.6.2.log`; firma verificata, versione `0.6.2`, versionCode `18`, min SDK 24 e target 36. UI, risoluzione lingua, runtime e interfaccia nativa della sourcemap corrispondono ai sorgenti finali. SHA-256 APK: `b2d63d5135272bab67ef5b48361ed11d8539077e44901f460e02bcabfa13e22a`. APK e archivio sorgenti aggiornati localmente.

## Pubblicazione GitHub — 1.0.0, 23 ottobre 2026

Preparata la prima distribuzione pubblica su PaoloConteDev/OpenCodenames, conservando il commit iniziale del repository. README principale in inglese, README.it.md in italiano, changelog e istruzioni di firma/rilascio. Versione app e protocollo 1.0.0, versionCode Android 19. Sorgenti, modulo Kotlin, contenuti e licenze inclusi; dipendenze installate, progetto Android generato, log, catture di dispositivi e materiale di firma esclusi da Git e archivi sorgenti.

Typecheck e Prettier superati, **119 test applicativi e 9 JVM** superati. Build release e lint vital completati per **arm64-v8a, armeabi-v7a e x86_64**, log locale `artifacts/build-release-1.0.0.log`. APK autonomo con bundle e font incorporati, min SDK 24 e target 36. Verificate versione 1.0.0/code 19 e tutte e tre le ABI tramite aapt; firma privata CN=Open Codenames, OU=Gleetch verificata tramite apksigner. Impronta SHA-256 del certificato: `4649f3eee3abac043bcaf81d442885b577c672ff8d3969c30e4b6841f665d71d`. Le precedenti anteprime debug richiedono disinstallazione prima di questa nuova firma, con perdita dei relativi dati locali; indicazione presente nei README e nelle note di release. Chiave privata protetta localmente, mai inclusa nella pubblicazione.

Confrontati con la sourcemap finale App.tsx, runtime, risoluzione lingua e componente bandiere; versione del manifest applicativo incorporato verificata come 1.0.0. I testi originali delle licenze di terze parti conservano gli spazi del fornitore; il controllo whitespace dei sorgenti li esclude.

Installazione effettiva nell'emulatore Android API 36 dopo aver rimosso soltanto l'anteprima dell'app dal dispositivo virtuale. Wi-Fi e Bluetooth disattivati; Home inglese rilevata da en-US, bandiera inglese, schermata impostazioni con Version 1.0.0. Verificati canali, preparazione Unico dispositivo senza nome, lobby con mazzo inglese e avvio con passaggio obbligatorio al suggeritore. Conferma del passaggio e tabellone visualizzato. Screenshot/dump locali in `artifacts/screenshots/release/`; nessun errore ReactNativeJS/AndroidRuntime nel log filtrato `artifacts/release-1.0.0-errors.log`. Nessuna nuova certificazione Bluetooth, ponte o hotspot su telefoni fisici: rimangono i limiti documentati e il ponte resta sperimentale.

SHA-256 di `OpenCodenames-1.0.0.apk`: `ea9af5897e39f72a715e3a1de5f187d66f49b399f7777642e784d24a984ef1ed`. Archivio sorgenti da commit di release e file SHA256SUMS distribuiti come allegati della release; gli hash degli archivi non sono incorporati nell'archivio stesso.
