# D-Group Kasse – Kurzvideos (9:16)

| Datei | Idee | Länge |
|---|---|---|
| `out/video-a.mp4` | **«الدرج ناقص»** – Geheimnis-Hook: «Der Kassenschub ist jede Nacht zu kurz?!» → Chaos mit Zettel und Taschenrechner → Auflösung mit dem D-Group-Kassensystem (Verkauf, TSE, Lager, Tagesbericht, Schublade stimmt) | 25,6 s |
| `out/video-b.mp4` | **«٣ ثواني»** – Tempo-Hook: Stoppuhr, «Du hast 3 Sekunden, bevor der Kunde geht» → alte Methode (47 s) gegen Kasse (3 s) → Funktionen → Aufruf | 23,2 s |
| `out/video-b3.mp4` | **«٣ ثواني» – Fassung 3 (B3)**: neuer Sprechertext (ElevenLabs-Datei `audio/voice-b3.mp3`, 41,9 s), Logos ohne Hintergrund (transparente PNGs in `img/`), Full HD 1080×1920 mit Bewegungsunschärfe | 42,6 s |
| `out/video-y1.mp4` | **YouTube-Werbung (Y1)**, 16:9 Full HD: «٧ أدوات صارو نظام واحد» – sieben Alltagswerkzeuge werden zu einem System; ein Tag im Laden (Einkauf, Kasse, Lager/PDA, Logistik, Konten, Buchhaltung) mit Zeitleiste; Sprachspur `audio/voice-y1.mp3` (63,6 s) | 64,4 s |
| `out/video-b2-4k.mp4`, `out/video-b2-1080.mp4` | **«٣ ثواني» – Studio-Fassung (B2)**: gleiche Idee, aber ohne Figur, reine Motion Graphics, **4K (2160×3840)** mit Bewegungsunschärfe, Wort für Wort passend zur ElevenLabs-Sprachspur, Musik mit Sidechain-Ducking | 29,0 s |

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

**Video B2 – gesprochener Text (ElevenLabs-Datei `audio/voice-b2.mp3`, 28 s)**

```
[loud] تلات ثواني!
[fast] هي كل اللي عندك… قبل ما الزبون يطلع!
[sarcastic] بالطريقة القديمة؟ ورقة… آلة حاسبة… وفكّة ضايعة!
[excited] وبكاشير مجموعة داماس للحلول التقنية؟
ضغطة… ضغطة… [energetic] دفع!
[triumphant] والفاتورة طلعت… تلات ثواني!
[fast] سريع، واضح، وكل شي بمكانو.
تي إس إي مضمّنة… شاشة لمس… سكانر باركود… وبي دي إي للجرد.
[playful] جرّب بنفسك؟
[warm] وفّر وقتك ووقت زبونك. تواصل معنا و جرب النسخة التجريبية.
```

Die Einblendungen in `src/ad-b2.js` sind auf die Sekunde der Sprachaufnahme gelegt (Zeitpunkte aus den Sprechpausen der Datei, `at:` je Wort). Wird die Sprachspur neu aufgenommen, müssen nur diese `at:`-Werte (und die Szenen-`from`/`to`) angepasst werden.

**Video B3 – gesprochener Text**

```
[loud] تلات ثواني… وخلصت العملية!
[fast] الزبون ما بحب ينتظر… وإنت كمان ما عندك وقت تضيّعه!
[sarcastic] لسه عم تكتب عالورق؟ وتحسب عالآلة الحاسبة؟ وتدوّر على الفكّة؟
[excited] مع نظام الكاشير من مجموعة داماس للحلول التقنية… كل شي صار أسرع وأسهل!
[energetic] اختار المنتج… امسح الباركود… استلم الدفعة…
[triumphant] والفاتورة جاهزة فورًا!
[fast] مبيعات أسرع… حسابات أدق… وإدارة أوضح.
        شاشة لمس، قارئ باركود، نظام TSE مدمج، وجهاز PDA للجرد ومتابعة المخزون.
[playful] ولسه مو مصدّق إنو الموضوع بهالسهولة؟
[warm] جرّبه بنفسك، وخلّي شغلك أسرع وأريح.
       تواصل مع مجموعة داماس للحلول التقنية، واطلب نسختك التجريبية اليوم!
```

Logos: `img/company-dark.png` / `company-light.png` (Firmenlogo, transparent; Schrift weiß bzw. marine), `img/app-mark.png` (App-Symbol freigestellt, ohne Kachel), `img/puzzle.png` (nur das Puzzle). Alle `at:`-Zeiten in `src/ad-b3.js` sind Sekunden der Sprachaufnahme.

## Neu rendern oder Texte ändern

Voraussetzungen: Node.js, ffmpeg, Python 3 mit numpy, Chromium (Pfad in `CHROME`).

```bash
npm i playwright-core
node render.mjs a        # → out/video-a.mp4
node render.mjs b        # → out/video-b.mp4
node render.mjs a 720    # schneller Probelauf in kleiner Auflösung
```

```bash
# YouTube-Werbung Y1 (16:9 Full HD, ca. 20 Minuten auf 4 Kernen)
node render-pro.mjs y1 --css 1920x1080 --out 1920 --scale 1.25 --music-from 7.2 --workers 4 --sub 4

# Studio-Fassung B3 (Full HD, ca. 12–15 Minuten auf 4 Kernen)
node render-pro.mjs b3 --voice audio/voice-b3.mp3 --workers 4 --sub 4
node render-pro.mjs b3 --out 2160         # dieselbe Fassung in 4K
node render-pro.mjs b3 --bench 8          # Geschwindigkeit je Aufnahme messen
node render-pro.mjs b3 --audio-only       # nur den Ton mischen → out/mix-b3.m4a
```

`--sub` ist die Zahl der Sub-Bilder je Frame für die Bewegungsunschärfe (180°-Verschluss), `--scale` ist die interne Renderauflösung (1.5 → 1620×2880, wird für scharfe Kanten auf `--out` heruntergerechnet), `--scale 1` ergibt einen schnellen Probelauf. Der Ton wird in `tools/make-audio.py` (Effekte und Musik als getrennte Spuren) erzeugt und mit ffmpeg unter die Stimme gemischt (Hochpass, Kompressor, −15 LUFS, Sidechain-Ducking, Limiter).

Alle Texte, Zeiten und Szenen stehen in `src/ad-a.js`, `src/ad-b.js` und `src/ad-b2.js` (Bausteine für B2: `src/pro.js`; eine Szene = ein Block mit `from`/`to` in Sekunden). Figur und Ausdrücke: `src/lib.js`. Kassen-Terminal: `src/parts.js`. Endkarte: `src/common.js`. Schriften: Cairo, Lalezar und Aref Ruqaa Ink (alle SIL Open Font License) plus Outfit.
Die Kassenoberfläche im Video ist eine nachgebaute Darstellung und zeigt kein echtes Kundensystem.
