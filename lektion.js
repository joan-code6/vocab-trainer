// Muster für eine Vokabel-JSON-Datei:
        // [
        //   { "latein": "amare", "deutsch": "lieben" },
        //   { "latein": "accipere", "deutsch": "annehmen, erhalten" }
        // ]
        // Muster für eine Lektionstext-JSON-Datei (LT1.json):
        // [
        //   { "text": "Gallia est omnis divisa in partes tres..." },
        //   { "text": "Alea iacta est." }
        // ]

        let vokabeln = [];
        let aktuelleLektion = null;
        let verfuegbareLektionen = [];
        let verfuegbareLektionstexte = [];

        const vokabelElement = document.getElementById('vokabel');
        const uebersetzungElement = document.getElementById('uebersetzung');
        const counterElement = document.getElementById('counter');
        const statusElement = document.getElementById('status');
        
        let aktuelleVokabel = null;
        let zustand = 0; // 0 = Vokabel anzeigen, 1 = Übersetzung anzeigen
        let vokabelSequenz = [];
        let aktuellerIndex = 0;
        let durchlauf = 1;
        let verlauf = []; // Speichert besuchte Indizes für Rückwärts-Navigation
        let schwierigkeitsMenge = new Set(); // Speichert schwierige Vokabeln
        let istLektionstext = false; // Merker ob LT geladen ist

        const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/Redstonekey/vocab-trainer/main/';
        const INDEX_URL = GITHUB_BASE_URL + 'index.json';

        // Am Ende des Durchlaufs die schwierigen Vokabeln als Array ausgeben
        function ausgabeSchwierigVokabeln() {
            if (schwierigkeitsMenge.size > 0) {
                const schwierigeListe = [];
                schwierigkeitsMenge.forEach(index => {
                    schwierigeListe.push({
                        latein: vokabeln[index].latein,
                        deutsch: vokabeln[index].deutsch
                    });
                });
                console.log("Schwierige Vokabeln als Array für neue HTML:");
                console.log(JSON.stringify(schwierigeListe, null, 2));
                // Beispiel für JavaScript-Code
                console.log("\nBeispiel-Code zum Kopieren:");
                console.log("const schwierigVokabeln = " + JSON.stringify(schwierigeListe, null, 2) + ";");
                statusElement.textContent = `${schwierigkeitsMenge.size} schwierige Vokabeln in der Konsole geloggt (F12)`;
                setTimeout(() => {
                    statusElement.textContent = '';
                }, 5000);
            }
        }

        // Funktion zum Mischen des Arrays (Fisher-Yates Shuffle)
        function shuffleArray(array) {
            let shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        
        // Counter aktualisieren
        function updateCounter() {
            counterElement.textContent = `${aktuellerIndex + 1}/${vokabelSequenz.length}`;
        }
        
        // Neue Lernsequenz generieren
        function neueSequenzGenerieren() {
            vokabelSequenz = shuffleArray(vokabeln);
            aktuellerIndex = 0;
            if (durchlauf > 1) {
                statusElement.textContent = `Neuer Durchlauf ${durchlauf} gestartet!`;
                setTimeout(() => {
                    statusElement.textContent = '';
                }, 3000);
            }
        }
        
        // Nächste Vokabel in der Sequenz anzeigen
        function naechsteVokabel() {
            if (aktuellerIndex >= vokabelSequenz.length) {
                if (!istLektionstext) ausgabeSchwierigVokabeln();
                durchlauf++;
                neueSequenzGenerieren();
            }
            aktuelleVokabel = vokabelSequenz[aktuellerIndex];
            if (istLektionstext) {
                vokabelElement.textContent = "";
                uebersetzungElement.textContent = aktuelleVokabel.text;
                vokabelElement.classList.remove('schwierig');
            } else {
                vokabelElement.textContent = aktuelleVokabel.latein;
                uebersetzungElement.textContent = '';
                // Überprüfen ob diese Vokabel als schwierig markiert ist
                if (schwierigkeitsMenge.has(vokabeln.indexOf(aktuelleVokabel))) {
                    vokabelElement.classList.add('schwierig');
                } else {
                    vokabelElement.classList.remove('schwierig');
                }
            }
            zustand = 0;
            updateCounter();
        }
        
        // Zur vorherigen Vokabel zurückgehen
        function vorherigVokabel() {
            if (verlauf.length > 0) {
                aktuellerIndex = verlauf.pop();
                aktuelleVokabel = vokabelSequenz[aktuellerIndex];
                vokabelElement.textContent = aktuelleVokabel.latein;
                uebersetzungElement.textContent = '';
                zustand = 0;
                
                // Überprüfen ob diese Vokabel als schwierig markiert ist
                if (schwierigkeitsMenge.has(vokabeln.indexOf(aktuelleVokabel))) {
                    vokabelElement.classList.add('schwierig');
                } else {
                    vokabelElement.classList.remove('schwierig');
                }
                
                updateCounter();
            } else {
                statusElement.textContent = "Keine vorherigen Vokabeln verfügbar";
                setTimeout(() => {
                    statusElement.textContent = '';
                }, 2000);
            }
        }
        
        // Vokabel als schwierig markieren
        function alsSchwierigeMarkieren() {
            const vokabelIndex = vokabeln.indexOf(aktuelleVokabel);
            
            if (schwierigkeitsMenge.has(vokabelIndex)) {
                schwierigkeitsMenge.delete(vokabelIndex);
                vokabelElement.classList.remove('schwierig');
                statusElement.textContent = "Von schwierigen Vokabeln entfernt";
            } else {
                schwierigkeitsMenge.add(vokabelIndex);
                vokabelElement.classList.add('schwierig');
                statusElement.textContent = "Als schwierig markiert";
            }
            
            setTimeout(() => {
                statusElement.textContent = '';
            }, 2000);
        }
        
        // Hilfe-Hinweis toggeln
        const hinweisElement = document.getElementById('hinweis');
        let hinweisSichtbar = true;

        function toggleHinweis() {
            hinweisSichtbar = !hinweisSichtbar;
            hinweisElement.style.display = hinweisSichtbar ? 'block' : 'none';
        }

        // Lektionen und Lektionstexte prüfen (L1.json bis L30.json, LT1.json bis LT30.json)
        async function findeVerfuegbareLektionen() {
            try {
                const response = await fetch(INDEX_URL);
                if (!response.ok) throw new Error('Network response was not ok');
                const indexData = await response.json();
                
                // Check which lesson files actually exist on GitHub
                verfuegbareLektionen = [];
                for (const entry of indexData) {
                    if (entry.path) {
                        try {
                            const lessonResponse = await fetch(GITHUB_BASE_URL + entry.path, { method: 'HEAD' });
                            if (lessonResponse.ok) {
                                verfuegbareLektionen.push(entry.path);
                            }
                        } catch (error) {
                            console.warn(`Lesson file ${entry.path} not accessible:`, error);
                        }
                    }
                }
                
                verfuegbareLektionstexte = []; // Currently no Lektionstexte on GitHub
                
                if (verfuegbareLektionen.length === 0) {
                    throw new Error('Keine Lektionen gefunden');
                }
            } catch (error) {
                console.error('Fehler beim Laden des Index:', error);
                statusElement.textContent = 'Fehler beim Laden der Lektionsliste';
                // Show error in UI
                vokabelElement.textContent = 'Error loading lessons';
                uebersetzungElement.textContent = 'Please try again later';
            }
        }

        // Popup anzeigen (jetzt auch Lektionstexte)
        function showLektionPopup() {
            const popup = document.getElementById('lektionPopup');
            const list = document.getElementById('lektionList');
            list.innerHTML = '';
            verfuegbareLektionen.forEach(lek => {
                const btn = document.createElement('button');
                btn.textContent = lek.replace('.json','');
                btn.className = 'lektion-btn';
                btn.onclick = () => {
                    popup.style.display = 'none';
                    ladeLektion(lek);
                };
                list.appendChild(btn);
            });
            // Lektionstexte hinzufügen
            verfuegbareLektionstexte.forEach(lt => {
                const btn = document.createElement('button');
                btn.textContent = lt.replace('.json','');
                btn.className = 'lektion-btn';
                btn.onclick = () => {
                    popup.style.display = 'none';
                    ladeLektionstext(lt);
                };
                list.appendChild(btn);
            });
            popup.style.display = 'flex';
        }
        function closeLektionPopup() {
            document.getElementById('lektionPopup').style.display = 'none';
        }

        // Lektion laden (wie gehabt)
        async function ladeLektion(dateiname) {
            try {
                const res = await fetch(GITHUB_BASE_URL + dateiname);
                if (!res.ok) throw new Error('Netzwerkfehler');
                vokabeln = await res.json();
                aktuelleLektion = dateiname;
                durchlauf = 1;
                schwierigkeitsMenge.clear();
                verlauf = [];
                istLektionstext = false;
                neueSequenzGenerieren();
                naechsteVokabel();
                statusElement.textContent = `Lektion ${dateiname.replace('.json','')} geladen`;
                setTimeout(() => statusElement.textContent = '', 2000);
            } catch (e) {
                statusElement.textContent = `Fehler beim Laden von ${dateiname}`;
                console.error('Fehler beim Laden der Lektion:', e);
            }
        }

        // Lektionstext laden (zeigt Text statt Vokabeln)
        async function ladeLektionstext(dateiname) {
            try {
                const res = await fetch(dateiname);
                const texte = await res.json();
                aktuelleLektion = dateiname;
                durchlauf = 1;
                schwierigkeitsMenge.clear();
                verlauf = [];
                istLektionstext = true;
                vokabeln = texte.map(t => ({
                    text: t.text
                }));
                neueSequenzGenerieren();
                naechsteVokabel();
                statusElement.textContent = `Lektionstext ${dateiname.replace('.json','')} geladen`;
                setTimeout(() => statusElement.textContent = '', 2000);
            } catch (e) {
                statusElement.textContent = `Fehler beim Laden von ${dateiname}`;
            }
        }

        // Event-Listener für Tastendruck
        document.addEventListener('keydown', function(event) {
            if (!aktuelleVokabel) return;
            
            if (event.code === 'Space') {
                event.preventDefault();
                if (istLektionstext) {
                    verlauf.push(aktuellerIndex);
                    aktuellerIndex++;
                    naechsteVokabel();
                } else {
                    if (zustand === 0) {
                        uebersetzungElement.textContent = aktuelleVokabel?.deutsch || "";
                        zustand = 1;
                    } else {
                        verlauf.push(aktuellerIndex);
                        aktuellerIndex++;
                        naechsteVokabel();
                    }
                }
            } else if (event.code === 'ArrowRight') {
                event.preventDefault();
                if (istLektionstext) {
                    verlauf.push(aktuellerIndex);
                    aktuellerIndex++;
                    naechsteVokabel();
                } else {
                    if (zustand === 1) {
                        verlauf.push(aktuellerIndex);
                        aktuellerIndex++;
                        naechsteVokabel();
                    } else {
                        uebersetzungElement.textContent = aktuelleVokabel.deutsch ?? "";
                        zustand = 1;
                    }
                }
            } else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                vorherigVokabel();
            } else if (event.code === 'ArrowUp') {
                event.preventDefault();
                alsSchwierigeMarkieren();
            } else if (event.key === 'h' || event.key === 'H') {
                toggleHinweis();
            } else if (event.key === 'l' || event.key === 'L') {
                showLektionPopup();
            }
        });
        
        // Touch-Event für mobile Geräte
        document.addEventListener('touchend', function(event) {
            if (!aktuelleVokabel) return;
            
            if (istLektionstext) {
                verlauf.push(aktuellerIndex);
                aktuellerIndex++;
                naechsteVokabel();
            } else {
                if (zustand === 0) {
                    uebersetzungElement.textContent = aktuelleVokabel?.deutsch || "";
                    zustand = 1;
                } else {
                    verlauf.push(aktuellerIndex);
                    aktuellerIndex++;
                    naechsteVokabel();
                }
            }
        });
        
        // Klick-Event
        document.addEventListener('click', function(event) {
            if (!aktuelleVokabel) return; // Guard clause
    
            if (istLektionstext) {
                verlauf.push(aktuellerIndex);
                aktuellerIndex++;
                naechsteVokabel();
            } else {
                if (zustand === 0) {
                    // Safe access with optional chaining
                    uebersetzungElement.textContent = aktuelleVokabel?.deutsch || "";
                    zustand = 1;
                } else {
                    verlauf.push(aktuellerIndex);
                    aktuellerIndex++;
                    naechsteVokabel();
                }
            }
        });
        
        // Uhrzeit-Anzeige (deutsche Zeit)
        function updateUhrzeit() {
            const jetzt = new Date();
            // Deutschland = Mitteleuropäische Zeit (MEZ/MESZ)
            const options = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' };
            document.getElementById('uhrzeit').textContent = jetzt.toLocaleTimeString('de-DE', options);
        }
        setInterval(updateUhrzeit, 10000); // alle 10 Sekunden aktualisieren
        updateUhrzeit();

        // Initialer Start
        (async function() {
            await findeVerfuegbareLektionen();
            if (verfuegbareLektionen.length === 0) {
                alert('Keine Lektionen (L1.json - L30.json) gefunden!');
            } else {
                showLektionPopup();
            }
        })();