# Piattaforma WebRTC per Networked Music Performance Multi-Peer

| | |
| - | - |
| **Autore**: | Gastaldi Paolo (_s277393_)|
| **Repository GitHub**: | https://github.com/paologastaldi-polito/master-thesis|

---

Questa applicazione è una evoluzione di [jacktrip-webrtc](https://github.com/jacktrip-webrtc/jacktrip-webrtc), con l'obiettivo di migliorarne la scalabilità in contesti multi-peeer.

L'applicazione si basa sull'utilizzo del canale [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel), che è stato dimostrato avere latenze migliori per contesti peer-to-peer realtime, e la gestione audio tramite [WebAudioAPI](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

Sono state valutate le performance della comunicazione tra thread con [MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel), [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) e [Atomics.waitAsync](https://www.chromestatus.com/feature/6243382101803008). L'accesso sicuro alle variabili condivise avviene tramite i metodi della famiglia [Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics).

## Installazione

Per utilizzare l'applicazione è necessario installare le dipendenze `Node.js` sia del client che del server.

```bash
npm install
cd client
npm install
cd ..
```

## Avvio dell'applicazione

```bash
npm start
```

oppure

```bash
node app.js
```
Viene avviato un server HTTP a cui si può accedere tramite gli URL http://localhost:8000 oppure https://localhost:44300. È stata mantenuta la possibilità di modificare le configurazioni dell'applicazione tramite variabili d'ambiente. Per maggiori dettagli consultare il file [Configuration.md](documentation/Configuration.md).

## Utilizzo

Per accedere all'applicazione è necessario inserire nella barra di ricerca del browser l'indirizzo http://localhost:8000 oppure https://localhost:44300.

>**Attenzione**: l'accesso all'applicazione da un altro dispositivo rispetto quello su cui è in esecuzione il server è possibile solamente utilizzando l'indirizzo https://\<host-ip-address\>:44300. La versione HTTP non è accessibile per ragioni di sicurezza per l'utilizzo degli AudioWorklet e degli SharedArrayBuffer, funzionalità su cui si basa l'applicazione.

Una volta connessi col pulsante 'Create Room' è possibile aprire una nuova stanza. Tramite la condivisione dell'URL altri utenti possono connettersi alla stessa stanza.

## Interfaccia grafica

L'interfaccia grafica permette di attivare speciali comportamenti dell'applicazione, utilizzati soprattutto in fase di test delle prestazioni. Ecco un elenco delle funzionalità disponibili, ciascuna individuata dal simbolo indicato sul pulsante:

- **microfono**: abilita/disabilita il microfono;
- **speaker**: abilita/disabilita la riproduzione;
- **grafico**: mostra/nasconde un grafico col tracciamento del jitter misurato in acquisizione e in ricezione per ogni peer. Questa funzionalità viene abilitata con la configurazione `isJitterTracked = true`;
- **freccia curva**: abilita/disabilita il loopback a livello di rete. Questa funzionalità viene abilitata con la configurazione `useAudioLoopback = true` e `audioLoopbackType = 'networkLoopback'`;
- **campana**: abilita/disabilita un suono di fondo continuo, utile per individuare più facilmente i pacchetti che vengono scartati o persi. Questa funzionalità viene abilitata con la configurazione `addSin = true`.

Inoltre, nella parte alta dell'applicazione è disponibile un menù dropdown con l'elenco di tutti i peer connessi in quel momento alla stanza. Selezionando un peer si abilita la funzione _solo_, quindi verrà riprodotto solamente l'audio ricevuto da quel peer e non da tutti gli altri.

> **Attenzione**: quando si connette un nuovo peer alla stanza è necessario ripete questa selezione, altrimenti il nuovo peer non risulterà mutato.

## Configurazione

La configurazione dell'applicazione è disponibile al momento solo con modifica manuale al file [config.js](client/public/js/room/config/config.js). Ecco di seguito una rapida spiegazione dei principali parametri:

- `logData`: abilita/disabilita la stampa nella console del browser dei log dell'applicazione;
    > **Attenzione**: questa operazione può risultare molto onerosa per il sistema e abbassare le performance.
- `showArchitectureInfo`: abilita/disabilita la stampa nella console del browser di un riassunto dell'architettura utilizzata al momento dell'applicazione;
- `audioContextOptions.sampleRate`: imposta la frequenza di campionamento a cui opera la catena audio;
    > **Attenzione**: non è garantito venga impostata realmente. In caso di discrepanze con la frequenza di campionamento del sistema operativo, alcuni browser introducono delle tecniche di _resampling_. Per essere sicuri di non introdurre ritardi aggiuntivi, da sistema operativo dev'essere impostata la stessa frequenza di campionamento dell'applicazione.
- `useSharedBufferForProcessorStatus`: abilita/disabilita il controllo dei thread audio tramite `SharedArrayBuffer`. In alternativa, vengono passati dei messaggi tramite il `MessageChannel`;
- `useMessageChannel`: utilizza il `MessageChannel` in fase di ricezione per la comunicazione tra i thread. In alternativa, viene utilizzato il buffer circolare condiviso realizzato con gli `SharedArrayBuffer`;
- `useWaitAsync`: utilizza il metodo `Atomics.waitAsync` in fase di trasmissione. Questo comporta la creazione di un secondo buffer circolare. In alternativa, utilizza il `MessageChannel`;
    > **Attenzione**: al momento questa funzionalità è disponibile solo nel browser Google Chrome.
- `useSingleAudioThread`: unisci le operazione di trasmissione e ricezione in un solo thread audio. In alternativa, vengono utilizzati due thread distinti;
- `queueSize`: dimensione della coda implementata come buffer circolare. L'offset tra gli indici di lettura e di scrittura, quindi il reale ritardo introdotto dalla coda, è la metà di questo valore;
- `isJitterTracked`: abilita/disabilita il tracciamento del jitter in acquisizione e in ricezione per ogni peer;
    > **Attenzione**: questa operazione può risultare molto onerosa per il sistema e abbassare le performance.
- `useBeepGeneratorAndAnalyzer`: inserisci un generatore di segnali acustici e un rilevatore di picco nella catena audio per le analisi con loopback;
- `useAudioLoopback`: abilita/disabilita i test con loopback;
- `audioLoopbackType`: scelta del tipo di loopback dall'elenco `audioLoopbackTypesToChooseFrom`;
- `addSin`: abilita/disabilita un suono di fondo continuo, utile per individuare più facilmente i pacchetti che vengono scartati o persi.