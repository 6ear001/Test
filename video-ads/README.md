# D-Group Kasse – zwei Kurzvideos (9:16, 1080×1920)

| Datei | Idee | Länge |
|---|---|---|
| `out/video-a.mp4` | **«الدرج ناقص»** – Geheimnis-Hook: «Der Kassenschub ist jede Nacht zu kurz?!» → Chaos mit Zettel und Taschenrechner → Auflösung mit dem D-Group-Kassensystem (Verkauf, TSE, Lager, Tagesbericht, Schublade stimmt) | 25,6 s |
| `out/video-b.mp4` | **«٣ ثواني»** – Tempo-Hook: Stoppuhr, «Du hast 3 Sekunden, bevor der Kunde geht» → alte Methode (47 s) gegen Kasse (3 s) → Funktionen → Aufruf | 23,2 s |

Hauptfigur: **ريم** (Unternehmerin, Vektor-Figur, Kleidung/Frisur im Code änderbar). Ton: Soundeffekte und leichter Beat, **ohne Sprecherstimme** – die Sprechertexte in der Schamisch-Fassung stehen unten.

## Sprechertext (Schamisch) mit Zeitmarken

**Video A**
| Zeit | Text |
|---|---|
| 0:00 | (flüsternd) «بس بس…» |
| 0:00,8 | «درج الكاشير ناقص كل ليلة؟!» |
| 0:03 | «بيني وبينك… المشكلة مو بالموظف.» |
| 0:05,6 | «المشكلة بالورقة والآلة الحاسبة!» |
| 0:08,7 | «الحل؟ كاشير D-Group.» |
| 0:11,1 | «كل بيعة بتنسجل لحالها… والـ TSE مضمّنة.» |
| 0:15 | «المخزون بينقص لحالو… وتقرير اليوم بضغطة.» |
| 0:18 | «وآخر الليل… الدرج مظبوط.» |
| 0:20,6 | «جرّب؟» |
| 0:21,8 | «الكاشير والمخزون والمحاسبة بنظام واحد. جرّب الديمو الحي على الموقع.» |

**Video B**
| Zeit | Text |
|---|---|
| 0:00 | «٣ ثواني!» |
| 0:00,5 | «هي كل اللي عندك قبل ما الزبون يطلع!» |
| 0:03,3 | «بالطريقة القديمة؟ ورقة… آلة حاسبة… وفكّة ضايعة!» |
| 0:06,7 | «وبكاشير D-Group؟» |
| 0:08,6 | «ضغطة… ضغطة… دفع… والفاتورة طلعت — ٣ ثواني!» |
| 0:13,7 | «سريع، واضح، وكل شي بمكانو.» |
| 0:15 | «TSE مضمّنة… شاشة لمس… سكانر باركود… وPDA للجرد.» |
| 0:17,7 | «جرّب بنفسك؟» |
| 0:18,9 | «وفّر وقتك ووقت زبونك. جرّب الديمو الحي على الموقع.» |

## Neu rendern oder Texte ändern

Voraussetzungen: Node.js, ffmpeg, Python 3 mit numpy, Chromium (Pfad in `CHROME`).

```bash
npm i playwright-core
node render.mjs a        # → out/video-a.mp4
node render.mjs b        # → out/video-b.mp4
node render.mjs a 720    # schneller Probelauf in kleiner Auflösung
```

Alle Texte, Zeiten und Szenen stehen in `src/ad-a.js` und `src/ad-b.js` (eine Szene = ein Block mit `from`/`to` in Sekunden). Figur und Ausdrücke: `src/lib.js`. Kassen-Terminal: `src/parts.js`. Endkarte: `src/common.js`. Schriften: Cairo, Lalezar und Aref Ruqaa Ink (alle SIL Open Font License) plus Outfit.
Die Kassenoberfläche im Video ist eine nachgebaute Darstellung und zeigt kein echtes Kundensystem.
