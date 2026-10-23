# Contenuti e attribuzioni

Il dizionario in `src/content/it.ts` è una selezione originale di parole comuni italiane, composta per questo progetto; non deriva da carte, elenchi o risorse dell’app ufficiale. Distribuzione MIT insieme al codice. Il test controlla numero minimo (500), normalizzazione NFC, equivalenza senza accenti, assenza di duplicati, lunghezza e sole lettere minuscole. La selezione è stata riletta durante l’implementazione; la qualità e l’equilibrio linguistico possono beneficiare di ulteriori partite di prova. Le parole sono estratte senza rimpiazzo.

Icona e grafica geometriche originali MIT. Nessun asset ufficiale CGE. Il suono è sintetizzato offline con Android ToneGenerator, senza campioni esterni. Il font Space Grotesk è incluso nel bundle da `@expo-google-fonts/space-grotesk`, con SIL Open Font License conservata in `THIRD_PARTY_NOTICES.txt` e nella schermata delle licenze. Non viene contattato Google Fonts.

Dalla 0.6.0 `src/content/words.ts` include anche selezioni originali di parole comuni inglesi (588), spagnole (574), tedesche (580) e francesi (576), distribuite MIT. Non sono elenchi ricavati dal gioco ufficiale. Il tedesco conserva le maiuscole dei sostantivi; alcune voci usano trattini. I test verificano almeno 500 voci per lingua, Unicode NFC, lettere e trattini interni, unicità normalizzata e tabelloni senza ripetizioni. Le regole tradotte sono in `src/content/rules.ts`; interfaccia, accessibilità e messaggi in `src/i18n/catalog.json`, con ordine delle traduzioni documentato nel codice. Anche questi contenuti sono inclusi nell’APK e non richiedono servizi di traduzione. Le traduzioni sono state controllate durante l’implementazione; la revisione editoriale da madrelingua e ulteriori playtest possono migliorarne naturalezza e bilanciamento.

Il nuovo marchio 0.2.0 (agenti corallo/blu e fumetto lime) è definito in `src/ui/brand.ts`. Lo script `scripts/generate-logo.cjs` genera icona 1024×1024, foreground adattivo e versioni SVG; usa resvg solo durante lo sviluppo. TweetNaCl è incluso per i tunnel dei ponti e i suoi avvisi sono raccolti insieme alle altre dipendenze.

Le bandierine del selettore lingua (Italia, Regno Unito, Spagna, Germania e Francia) sono disegnate con forme SVG locali in `src/ui/LanguageFlag.tsx`. Non richiedono immagini remote o un font emoji; lo stesso componente è usato nel menu e nel pulsante della Home.

`npm run licenses` raccoglie testi LICENSE, NOTICE e COPYRIGHT delle dipendenze npm di produzione effettivamente installate, con nomi, versioni e licenze, e genera sia l’avviso testuale sia il JSON incluso nell’app. Eseguirlo dopo ogni cambio del lockfile. L’APK conserva inoltre i metadati e gli avvisi delle librerie native AAR/JAR attraverso il packaging Android; per redistribuire modifiche alle dipendenze controllarne sempre le condizioni.

Le meccaniche prendono come riferimento il regolamento del gioco da tavolo classico di Vlaada Chvátil, pubblicato da Czech Games Edition. Consultati il 22 ottobre 2026:

- [CGE — Codenames](https://www.czechgames.com/games/codenames)
- [Regolamento inglese, archivio CGE indicizzato](https://czechgames.com/files/rules/codenames-rules-en.pdf) (l’URL storico può reindirizzare alla pagina del gioco).
- [Regolamento CGE, filemanager, indicizzato per gli indizi esperti](https://filemanager.czechgames.com/storage/files/codenames/rules/codenames-rules-en.pdf) (il download diretto ha restituito 404 durante la verifica; usati gli estratti indicizzati del regolamento ufficiale, non le regole dell’app).

Open Codenames è un progetto indipendente e non affiliato a CGE. I riferimenti al gioco originale identificano soltanto l’origine delle meccaniche; non implicano approvazione o licenza del marchio. Nessun materiale editoriale ufficiale è riprodotto nel prodotto.
