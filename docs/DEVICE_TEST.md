# Collaudo manuale su dispositivi reali

**Da eseguire.** Nessuna riga di questa procedura è un esito positivo finché non viene registrata con quattro telefoni fisici. Un emulatore non prova Bluetooth. Conservare il report insieme all’hash dell’APK collaudato.

## Registro

Data, revisione sorgenti, SHA-256 APK, architetture, marca/modello/versione Android di A/B/C/D, impostazioni di batteria, risultato, difetto e passaggi di riproduzione. Ruotare l’host tra almeno due produttori. Registrare separatamente Android 7–11 e 12+ se disponibili. Per 5–8 giocatori ripetere aggiungendo un telefono alla volta; finché non fatto il limite fisico resta non verificato.

| Prova | Atteso | Esito reale |
| --- | --- | --- |
| Prima installazione offline | Home, font e regole disponibili; nessun download | DA ESEGUIRE |
| Host + tre client Bluetooth | Quattro presenze simultanee, approvate | DA ESEGUIRE |
| ECO da B/C/D | Arrivo host e risposta su ciascun client | DA ESEGUIRE |
| Partita completa Bluetooth | Stati concordi, regole rispettate | DA ESEGUIRE |
| Rientro client | Stessa identità, ruolo, versione e carte | DA ESEGUIRE |
| Arresto/riavvio host | Stanza recuperabile, nessun nuovo tabellone | DA ESEGUIRE |
| Background e blocco schermo | Pausa chiara, recupero senza alterazioni | DA ESEGUIRE |
| Hotspot senza Internet | Quattro presenze e partita completa via TCP | DA ESEGUIRE |
| TalkBack e caratteri grandi | Carte e comandi leggibili e annunciati | DA ESEGUIRE |
| Autonomia per un’ora | Nessun blocco; annotare consumo e temperatura | DA ESEGUIRE |

## 1. Prova tecnica prima della partita

1. Installare il medesimo APK autonomo su A/B/C/D, scollegare USB e fermare Metro. Non usare Expo Go o una build debug che richiede il PC.
2. Su tutti: spegnere Wi-Fi e dati mobili e verificare gli interruttori. Non usare Nearby Connections. Accendere solo Bluetooth. Per Android 7–11 abilitare la posizione di sistema se necessaria alla scansione; ciò non attiva Wi-Fi/dati nell’app.
3. A apre una stanza Bluetooth e conferma la visibilità. B/C/D cercano, verificano il nome, accettano l’eventuale associazione Android, chiedono ingresso. A approva tutte le richieste.
4. Su A aprire “Diagnostica · prova tecnica”: devono risultare quattro partecipanti connessi contemporaneamente. Non è sufficiente collegarli uno alla volta sostituendo il precedente.
5. B/C/D inviano ciascuno un ECO distinto. A deve vedere tutti e tre; ogni client deve ricevere il proprio ECO dall’host. Ripetere alternando l’ordine e mantenendo tutti i socket aperti.
6. Spegnere Bluetooth su C o allontanarlo. Entro il timeout di circa 20 secondi A/B/D devono mostrare C scollegato. Riaccendere/riavvicinare e premere Riprendi o attendere la riconnessione. C deve riottenere la stessa sessione senza una seconda persona in lobby.
7. Ripetere con un dispositivo che non era già associato e con uno già associato. Rifiutare una richiesta, negare i permessi, disattivare il Bluetooth: verificare errori leggibili e nuovo tentativo.

Se questa prova fallisce, registrare il limite effettivo e risolvere il trasporto prima di promuovere l’APK. Le schermate completate non sostituiscono questa soglia.

## 2. Partita Bluetooth completa

1. A decifratore rosso, B suggeritore rosso, C suggeritore blu, D decifratore blu. Tutti pronti; controllare che l’avvio sia bloccato prima di avere ruoli validi.
2. Verificare 25 parole uguali. I due suggeritori devono avere la stessa mappa con distribuzione 9/8/7/1; A e D vedono colori solo delle carte scoperte. L’host A non deve vedere la mappa dalla propria UI.
3. Verificare turno casuale, indizio pubblico e impossibilità di inviare dall’altro suggeritore o scegliere dall’altro team/ruolo. Tentare cambio di squadra durante il gioco.
4. Indizio 1: obbligo di almeno un tentativo, massimo due. Una carta propria consente di continuare; neutrale e avversaria terminano. Testare annullamento della conferma di una carta e tocchi doppi.
5. In nuove partite verificare 0 e ∞ (illimitati fino a errore), assassino (sconfitta immediata), ultima carta propria e ultima carta avversaria (vittoria della squadra proprietaria). Per forzare queste scelte consultare la mappa su un telefono suggeritore senza diffonderla nel normale gioco.
6. Per la concorrenza usare almeno cinque telefoni con due decifratori nello stesso team: scegliere contemporaneamente carte diverse sul medesimo stato. Una sola scelta deve essere accettata; l’altro vede rifiuto di versione e aggiornamento.
7. Concludere una partita senza USB, Wi-Fi o dati. Tornare alla lobby; i pronti si azzerano e la nuova missione genera una nuova mappa.

## 3. Recupero

Durante un turno con indizio annotare versione, parole scoperte e tentativi. Scollegare un client dopo una conferma, riportarlo online: non deve comparire una seconda scelta automatica. Mettere A in background, bloccarne lo schermo, poi riaprire: mostrare pausa, riaprire i socket e riprendere. Infine arrestare l’app host e riavviarla: “Riprendi la tua partita”; altri “Rientra nella tua sessione”. Nessun seed o tabellone nuovo, ruoli invariati, cronologia presente. Verificare anche l’arresto di un client e la revoca/rifiuto di una sessione rimossa in lobby.

## 4. LAN/hotspot senza Internet (prova separata)

Disabilitare Bluetooth, dati mobili e accesso Internet del router, oppure creare un hotspot con dati mobili spenti. Collegare B/C/D all’hotspot di A e scegliere di rimanere sulla rete senza Internet. A ospita in LAN; B scansiona il QR, C/D usano IPv4 e codice. Verificare codice errato, approvazione, ECO simultanei e partita completa. Ripetere perdita/rientro e recupero host. Annotare eventuale isolamento client o hotspot che si spegne automaticamente; non imputare al protocollo l’assenza di raggiungibilità IP.

## 5. Informazioni e accessibilità

Controllare con log di sviluppo filtrati o con test di protocollo che gli snapshot per decifratori non contengano `color` delle carte coperte, seed o sessioni. Non stampare il file host, i token o la mappa in report pubblici. TalkBack deve annunciare parola, stato e colore solo quando autorizzato. Verificare 25 parole su un telefono stretto, tastiera nell’invio indizio, safe area, scala caratteri, simboli oltre ai colori, feedback disattivabile e suono senza collegamento Internet.

## 6. Dieci dispositivi e ponte Bluetooth sperimentale — DA ESEGUIRE

Preparare dieci telefoni A–J e registrare chipset, produttore e versione Android. Il limite logico comprende l’host e i telefoni ponte.

1. A ospita; B–H entrano direttamente via Bluetooth, con Wi-Fi e dati spenti. Verificare otto presenze simultanee e un ECO da ciascun client. Non superare sette periferiche dirette nella stessa rete Bluetooth.
2. B attiva **Ponte sperimentale**. Prima verificare che il collegamento A–B rimanga attivo; poi I e J cercano il servizio del ponte B, si associano a B e richiedono ingresso tramite ponte.
3. I/J confrontano fisicamente tutti i gruppi dell’impronta con il telefono A. Prima della conferma A non deve ricevere una richiesta di ingresso per I/J. Dopo la conferma A approva entrambi: dieci presenze simultanee, ECO cifrati da I/J, nessuna duplicazione. Un undicesimo partecipante deve essere rifiutato.
4. I suggerisce ai rossi, J ai blu, A–H decifratori. Giocare una partita completa: I/J vedono tutti i colori; i decifratori, incluso B, solo quelli rivelati. Verificare che i messaggi inoltrati da B siano esclusivamente buste cifrate, senza stampare mappe o token nel report.
5. Scollegare I, farlo rientrare mantenendo J; poi spegnere B. A deve segnalare B/I/J assenti; gli altri possono continuare. Ripristinare B, rientrare e riattivare il ponte se l’app è stata riavviata: I/J recuperano identità, ruoli e stato, senza ripetere comandi. Provare anche background e dialogo di visibilità di B.
6. Sostituire il vero host con una stanza nuova: un client con pin salvato deve rifiutare la chiave cambiata prima dell’invio delle credenziali. Per un ingresso nuovo non confermare un’impronta differente. Testare rifiuto/revoca di un figlio e rifiuto di ponte su ponte.
7. Ruotare il ponte fra almeno due chipset e l’host fra almeno due produttori. Annotare esplicitamente controller che non consentono il collegamento simultaneo client/server. Non classificare l’assenza di errore all’apertura dei listener come prova del collegamento radio.
8. Prova separata LAN: A + nove client su hotspot senza Internet, dopo aver verificato che l’hotspot consenta nove client. Verificare ECO, partita, rientro del nono client e rifiuto dell’undicesimo dispositivo.

Gli script `scripts/lan-smoke.cjs … 9` e `scripts/relay-smoke.cjs` servono solo allo sviluppo con client Node e socket TCP. Il secondo verifica l’instradamento e la cifratura dell’APK, usando la chiave appresa dal collegamento locale di collaudo; non sostituisce né la verifica umana dell’impronta nella UI né questa prova radio.

## 7. Regressione playtest 0.3.0

1. Aprire Home, creazione, lobby e partita: nessuna etichetta OFFLINE nell’intestazione. In partita la propria squadra e il ruolo restano indicati nell’intestazione fissa anche scorrendo il tabellone.
2. Approvare quattro persone: assegnazione iniziale rosso/blu/rosso/blu. Occupare un posto suggeritore: gli altri vedono quel posto disabilitato; suggeritore in cima alla propria squadra. L’host mescola, verificando numeri bilanciati, un suggeritore per squadra e pronti azzerati. Un client non può mescolare.
3. Creare senza tempo e poi con 30 secondi. Nel secondo caso verificare scadenza prima dell’indizio e durante le scelte, cambio automatico singolo, nuovo turno completo. Inviare una scelta al limite: nessuna scelta applicata al nuovo turno con la vecchia versione. Verificare anche 60/90/120/180 e orologi dei telefoni differenti.
4. Scegliere una carta neutrale e una avversaria: sfondo nettamente più scuro e dicitura SCOPERTA; pallino del team che ha premuto, conservato dopo il cambio turno. Suggeritori e decifratori concordano su questa informazione.
5. Bloccare il telefono di un non host, avanzare la partita dagli altri e sbloccarlo: rientro automatico nella stessa sessione, carte e versione attuali prima della riabilitazione dei comandi. Ripetere con Home/cambio app e con un comando pendente. Nessun replay automatico. La partita degli altri deve continuare durante l’assenza.
6. Mettere l’host in background con timer attivo, attendere e rientrare: tempo residuo conservato. Riavvio improvviso host: stesso tabellone, residuo basato sulla scadenza salvata, al massimo un cambio immediato se già trascorsa. Ripetere anche su Bluetooth e con un client attraverso il ponte.

Per collaudare il ciclo di vita di un client Android sull’emulatore: `node scripts/client-lifecycle-smoke.cjs`, collegare l’app a `10.0.2.2` con il codice stampato, bloccare/cambiare app, inviare `advance` dalla CLI e rientrare. Lo script ospita esclusivamente su loopback con l’autorità del progetto e tre partecipanti di collaudo; non certifica Bluetooth.

## 8. Ricerca Bluetooth 0.3.1 — DA ESEGUIRE

Segnalazione del playtest: dopo **Rendi host visibile**, uno di tre client trovava l’host; il gruppo ha proseguito su hotspot. Modelli e versioni Android non disponibili. Non è stata accertata la causa sui telefoni: il codice precedente nascondeva i candidati se SDP non restituiva gli UUID del gioco.

1. Installare 0.3.1 su host e tre client, tenere l’host nella lobby e rinnovare la visibilità. Cercare dai tre client, annotando se il telefono compare come dispositivo non verificato o host riconosciuto. Il candidato deve essere selezionabile subito, anche durante la verifica dei servizi.
2. Se compare come non verificato, riconoscere il nome e scegliere **Prova collegamento all’host**. Controllare associazione su entrambi i telefoni e richiesta effettiva sulla lobby host; verificare tre connessioni ed ECO simultanei. Non classificare la semplice presenza nella lista come connessione riuscita.
3. Ripetere con telefono già associato e host non rilevato nella scansione corrente. Il telefono associato deve apparire comunque; se spento/lontano il tentativo deve fallire senza inventare una stanza. Se assente, associare dalle impostazioni Android e ripetere.
4. Interrompere durante ricerca e durante verifica; ripetere, verificando lista pulita e fine dell’indicatore. Collegarsi prima della fine della verifica; nessuna coda di ricerca deve continuare ad avviare richieste dell’app. Eventuali risposte Android tardive non devono duplicare o declassare il dispositivo.
5. Provare un dispositivo Classic estraneo al gioco: resta non verificato e non ottiene alcuna sessione del gioco. Il nome non costituisce autenticazione. Provare anche servizio non riconosciuto del ponte con **Collega come ponte sperimentale**, mantenendo confronto dell’impronta e approvazione host.
6. Ripetere prima con Wi-Fi/dati spenti e poi su un altro host, registrando hash APK, tempi, modelli quando disponibili e risultati distinti per rilevamento, verifica servizio e connessione. L’emulatore e i test della coda non sostituiscono questa prova.

## 9. Incompatibilità fra versioni — 0.3.2, DA ESEGUIRE

1. Su Bluetooth e separatamente su hotspot, host 0.3.2 e client 0.3.1: collegamento rifiutato, nessuna nuova presenza/richiesta da approvare, messaggio di incompatibilità sul client. Invertire host/client: il client nuovo deve fermarsi alla prima risposta senza versione, senza applicare snapshot né riprovare automaticamente.
2. Con tutti i telefoni 0.3.2, approvare gli ingressi e giocare normalmente. Recuperare una sessione salvata prima dell’aggiornamento dopo avere aggiornato tutti i telefoni: identità e stato rimangono recuperabili. Ripetere un rientro verso host di versione diversa: deve essere bloccato anche con credenziali valide.
3. Verificare la stessa versione su host, ponte e figli; cambiare versione di un solo componente per volta. Nessun figlio incompatibile deve essere approvabile o ricevere uno snapshot. Conferma dell’impronta sempre richiesta per un nuovo tunnel compatibile.
4. Dopo incompatibilità, attendere 30 secondi, cambiare app e rientrare: nessun ciclo automatico di connessioni. Aggiornare i telefoni e richiedere un nuovo ingresso: il blocco viene rivalutato. Nelle impostazioni e in diagnostica compare la versione effettiva dell’APK.

## 10. Modalità Condivisa e Decifratori — 0.4.0, radio DA ESEGUIRE

1. Installare 0.4.0 su due telefoni. Creare **Condivisa**: host inizialmente Suggeritori, client Decifratori. Approvare il client, confermare pronti e avviare. Un solo dispositivo deve essere insufficiente. Ripetere separatamente su Bluetooth e hotspot senza Internet.
2. Prima della conferma entrambi mostrano il passaggio alla squadra attiva, senza tabellone/mappa. Confermare sul telefono suggeritori: compaiono i colori; sul decifratore restano coperti anche dopo la propria conferma. Inviare indizio e scegliere una carta pubblica: accordo sul risultato e pallino della squadra attiva.
3. Terminare un turno dopo un tentativo, oppure scegliere una neutrale/avversaria: nuova squadra e nuovo passaggio su entrambi. Lo stesso suggeritore può ora dare l’indizio per l’altra squadra e lo stesso decifratore scegliere per essa. Nessuna scelta valida senza conferma del nuovo turno.
4. Aggiungere un secondo decifratore: conferme indipendenti e simultanee, scelte concorrenti con le normali regole della prima accettata. Nessuna seconda sessione suggeritori consentita, neppure scegliendo una squadra diversa; shuffle assente. Provare host decifratore e client suggeritore scambiando i ruoli in lobby.
5. Timer di 30 secondi: farlo scadere sulla schermata di passaggio, verificare che la conferma vecchia non sblocchi il nuovo turno. Il timer comprende il tempo del passaggio. Verificare annullamento/nuova missione con nuove conferme.
6. Bloccare un client, cambiare turno dagli altri, rientrare: prima sincronizzazione con tabellone precedente nascosto, poi passaggio al turno attuale e stessa identità. Riavviare host e recuperare la stanza: modalità e turno conservati, nessuna conferma vecchia riutilizzata.
7. Creare Classica: minimo quattro dispositivi, due suggeritori separati, squadre fisse, shuffle e nessun passaggio del telefono. Verificare **Decifratore/Decifratori** in lobby, partita, intestazione e regole. Provare telefoni stretti e caratteri grandi per le etichette Condivisa e 2–10 dispositivi.

## 11. Unico dispositivo — 0.5.0, telefono fisico DA ESEGUIRE

1. Su un solo telefono spegnere Bluetooth, Wi-Fi e dati; negare o revocare Dispositivi vicini. **Gioca → Unico dispositivo**: dalla 0.5.3 il nome non viene richiesto; non compaiono canali di connessione, inviti/QR, ruoli personali o shuffle. Preparare e avviare con un solo dispositivo; nessuna richiesta di permessi Bluetooth.
2. All’inizio il telefono indica squadra e suggeritore e nasconde il tabellone. Confermare come suggeritore: compare la mappa completa. Indizio → **Nascondi mappa e passa ai decifratori**: la mappa scompare prima di consegnare il telefono, compare il passaggio ai decifratori della stessa squadra. Nessuna scelta prima della nuova conferma.
3. Confermare come decifratori: carte coperte senza colori, indizio pubblico e azioni consentite. Carta propria consente altre scelte; carta neutrale/avversaria o fine turno passa al suggeritore della squadra avversaria con nuova conferma. Ripetere entrambe le direzioni con lo stesso telefono. Controllare pallini, N+1, assassino e vittoria.
4. Impostare 30 secondi e farli scadere durante un passaggio, provando una conferma vecchia: non sblocca ruolo/fase/turno nuovi. Bloccare schermo o cambiare app durante mappa visibile: al ritorno stessa partita e tempo residuo, ma mappa nascosta fino a nuova conferma.
5. **Salva ed esci**, chiudere/riaprire l’app, **Riprendi la tua partita**: carte, indizio, fase e squadra conservati, ruolo nuovamente da confermare. Provare sia fase suggeritore sia fase decifratori. Non deve essere avviata alcuna connessione Bluetooth/LAN. Dopo annullamento/fine, nuova missione avviabile senza assegnazioni di ruoli o altre presenze.
6. Provare telefoni stretti e caratteri grandi, intestazione con ruolo corrente, conferme di entrambi i ruoli e pulsante per nascondere la mappa. Ricontrollare creazione/ingresso Classica e Condivisa con i canali di connessione e le regole precedenti.

## 12. Scelta del canale — 0.5.1

1. Dalla Home premere **Gioca**: devono comparire, nell’ordine, Wi-Fi / hotspot, Bluetooth e Unico dispositivo. Dalla 0.5.2 le tre scelte hanno lo stesso stile viola, con “Dispositivi 2–10”, “Dispositivi 2–8” e “1 dispositivo”; la Home mostra “Senza account” al posto del numero di dispositivi. Non si sceglie ancora se ospitare o entrare.
2. Scegliere **Bluetooth**: devono comparire **Ospita partita** ed **Entra in partita**. Provare entrambi: nickname in alto, modalità Classica/Condivisa e timer solo per l’host. La ricerca parte soltanto dopo **Cerca la stanza**.
3. Ripetere con **Wi-Fi / hotspot**; l’ingresso deve aprire i controlli IP/codice/QR. Verificare che il canale scelto sia mantenuto fino alla lobby.
4. **Indietro** deve seguire ricerca → preparazione → Ospita/Entra → canali → Home. Da Unico dispositivo deve tornare direttamente ai canali.
5. Scegliere **Unico dispositivo**: preparazione immediata, senza Ospita/Entra, senza campo nome e senza selettore Classica/Condivisa. Avviare con radio spente. Tornare ai canali e scegliere Bluetooth o Wi-Fi: devono ricomparire Ospita/Entra, il campo nickname e le normali opzioni multiplayer.
6. Verificare che i pulsanti di ripresa della Home recuperino il canale salvato senza ripetere la scelta. Cambiando canale durante la creazione non devono rimanere indirizzi o codici dell’altro canale.

Questa lista copre anche i percorsi da completare su telefoni fisici; gli esiti effettivi sull’emulatore sono registrati in VERIFICATION.md.

## 13. Lingue — 0.6.0

1. Nella Home il pulsante quadrato con la bandiera selezionata deve stare subito a sinistra dell’ingranaggio. Aprirlo e provare Italiano, English, Español, Deutsch e Français; ciascun nome ha accanto la rispettiva bandiera (Italia, Regno Unito, Spagna, Germania, Francia). Nomi nativi sempre riconoscibili, selezione evidenziata e nessun download. Dalla 0.6.1 il pulsante Home deve aggiornare subito la bandiera e conservarla dopo riavvio; con lettore schermo deve essere annunciata la lingua selezionata, senza leggere separatamente la bandiera decorativa.
2. In ogni lingua controllare Home, canali, Ospita/Entra, nomi dei ruoli, conferme native, carte coperte/scoperte, timer, risultato, registro, regole e impostazioni. Provare caratteri grandi e schermi stretti, soprattutto tedesco. I dialoghi Android seguono la lingua di sistema.
3. Dalla 0.6.2, su un’installazione di prova senza preferenze, impostare una lingua Android supportata (anche variante regionale): la Home deve aprirsi direttamente nella lingua corrispondente, con la giusta bandiera. Ripetere con portoghese o altra lingua non supportata: deve aprirsi in inglese. Chiudere/riaprire e cambiare lingua Android: la scelta già salvata deve restare. Una scelta manuale deve prevalere. Preferenze precedenti senza lingua devono rilevare il sistema, mantenendo suono e vibrazione; le partite salvate conservano il proprio mazzo.
4. Creare una stanza con host francese e client con UI inglese/spagnola/tedesca: in lobby la lingua delle parole deve risultare Français, il tabellone deve essere identico e francese per tutti. Verificare ruoli e riservatezza delle carte in Classica e Condivisa. Non tradurre soprannomi, indizi o parole ricevute.
5. Unico dispositivo: nessun nome, avvio con radio spente in ogni lingua; handover per ruolo/squadra e mappa solo dopo conferma. Salvare, cambiare lingua nella Home e riprendere: UI aggiornata, stesse parole/fase/carte e lingua della partita precedente. Anche una nuova missione nella stessa stanza conserva il mazzo; una nuova stanza usa la nuova preferenza dell’host.
6. In tedesco provare un indizio uguale a una carta ancora coperta cambiando ß in SS: deve essere rifiutato. Verificare anche accenti francesi/spagnoli e trattini interni. Tutti i telefoni multiplayer devono usare esattamente la stessa versione 0.6.0.

Registrare separatamente le prove radio fisiche e quelle su emulatore.

## 14. Pop-up di rivelazione — telefono fisico DA ESEGUIRE

1. In Unico dispositivo scegliere una carta propria, neutrale, avversaria e l’assassino: deve apparire un pop-up centrato con simbolo, parola, colore, squadra che ha scelto ed esito. Suono e vibrazione rispettano le preferenze. Nessuna chiusura automatica.
2. Quando la scelta cambia turno o conclude la missione, il tabellone pubblico del turno appena giocato resta dietro il pop-up, con la carta appena scoperta evidenziata. Nessun colore riservato deve comparire. **Continua** e il tasto Indietro Android chiudono il pop-up; solo allora appare il passaggio del telefono o il risultato finale. Una carta corretta che esaurisce i tentativi segue lo stesso percorso di cambio turno.
3. Con carta propria e tentativi rimasti, **Continua** torna alle scelte dello stesso turno. Tocchi fuori dal pop-up non scoprono altre carte e non chiudono il risultato.
4. Ripetere in Classica e Condivisa, come suggeritore e decifratore. Gli aggiornamenti di rete e il timer proseguono anche con il pop-up aperto; alla chiusura compare lo stato attuale. Cambio app, disconnessione, nuova missione o uscita dalla sessione non devono riproporre vecchi risultati.
5. Provare tutte le lingue, lettore schermo, movimento ridotto, schermo piccolo/orizzontale e caratteri grandi: parola ed esito restano leggibili scorrendo, **Continua** resta raggiungibile e il contenuto sottostante non riceve il focus mentre il pop-up è aperto.
