<?php
// Einstellungen der PHP-API. Diese Datei wird nie ausgeliefert, sondern nur vom Server gelesen.
return [
    // An diese Adresse wird bei jeder Beratungsanfrage eine E-Mail geschickt. Leer = keine E-Mail.
    'notifyEmail' => '',

    // Absender der Benachrichtigung. Bei IONOS am besten eine Adresse Ihrer eigenen Domain.
    // Leer = noreply@<Ihre-Domain>
    'mailFrom' => '',

    // Nur auf true setzen, wenn ein Reverse Proxy die echte Besucher-IP in X-Forwarded-For liefert.
    // Sonst können Besucher den Spam-Schutz umgehen.
    'trustProxy' => false,

    // Spam-Schutz: höchstens so viele Anfragen je Zeitfenster und Besucher.
    'rateMax' => 5,
    'rateWindowSeconds' => 600,
];
