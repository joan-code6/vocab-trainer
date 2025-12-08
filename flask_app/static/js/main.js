let currentWords = [];
let currentIndex = 0;
let showingTranslation = false;
let selectedLessons = [];
let lastShownWordId = null;

function startSession() {
    const checkboxes = document.querySelectorAll('.lektion-checkbox:checked');
    selectedLessons = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (selectedLessons.length === 0) {
        alert("Bitte wähle mindestens eine Lektion aus.");
        return;
    }

    fetch('/api/get_words', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessons: selectedLessons, last_word_id: lastShownWordId }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.length === 0) {
            alert("Keine Vokabeln gefunden.");
            return;
        }
        currentWords = data;
        currentIndex = 0;
        document.getElementById('lektionPopup').style.display = 'none';
        document.getElementById('controls').style.display = 'flex';
        document.getElementById('lektionBtn').style.display = 'block';
        document.getElementById('progressContainer').style.display = 'block';
        updateProgress();
        showWord();
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function showWord() {
    if (currentIndex >= currentWords.length) {
        // Fetch more words (endless loop)
        loadMoreWords();
        return;
    }

    const word = currentWords[currentIndex];
    lastShownWordId = word.id;
    document.getElementById('vokabel').innerText = word.latin;
    document.getElementById('uebersetzung').innerText = "";
    document.getElementById('counter').innerText = `${currentIndex + 1} / ${currentWords.length}`;
    showingTranslation = false;
    
    // Optional: Show confidence indicator
    const status = document.getElementById('status');
    if (word.confidence > 0.7) {
        status.innerText = "Bekannte Vokabel";
        status.style.color = "green";
    } else {
        status.innerText = "Üben empfohlen";
        status.style.color = "orange";
    }
}

function revealTranslation() {
    if (!showingTranslation && currentIndex < currentWords.length) {
        const word = currentWords[currentIndex];
        document.getElementById('uebersetzung').innerText = word.german;
        showingTranslation = true;
    }
}

function submitResult(isCorrect) {
    if (currentIndex >= currentWords.length) return;
    
    if (!showingTranslation) {
        revealTranslation();
        return; // Don't submit yet if they haven't seen the answer? 
        // Actually, usually you reveal then judge. 
        // If they press Up/Down immediately, it implies they knew it or didn't.
        // Let's assume Up/Down submits immediately if translation is NOT shown?
        // Or maybe Up/Down reveals AND submits?
        // The prompt says "user should deside by giving the word arrow key up or down".
        // Standard Anki flow: Show Question -> Space (Show Answer) -> Rate.
        // Let's enforce: Space to show, then Arrows to rate.
    }

    const word = currentWords[currentIndex];
    
    fetch('/api/submit_result', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            word_id: word.id, 
            correct: isCorrect 
        }),
    })
    .then(() => {
        updateProgress();
    });

    currentIndex++;
    showWord();
}

function goToPrevious() {
    if (currentIndex > 0) {
        currentIndex--;
        showWord();
    }
}

function loadMoreWords() {
    fetch('/api/get_words', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessons: selectedLessons, last_word_id: lastShownWordId }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.length === 0) {
            alert("Keine weiteren Vokabeln gefunden.");
            return;
        }
        currentWords = currentWords.concat(data);
        showWord();
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function openLektionSelector() {
    document.getElementById('lektionPopup').style.display = 'flex';
}

function updateProgress() {
    fetch('/api/get_progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessons: selectedLessons }),
    })
    .then(response => response.json())
    .then(data => {
        const percentage = Math.round(data.progress * 100);
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressText').innerText = percentage + '% gelernt';
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('lektionPopup').style.display !== 'none') return;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === 'Space' || e.code === 'ArrowRight') {
        revealTranslation();
    } else if (e.code === 'ArrowUp') {
        if (showingTranslation) submitResult(true);
    } else if (e.code === 'ArrowDown') {
        if (showingTranslation) submitResult(false);
    } else if (e.code === 'ArrowLeft') {
        goToPrevious();
    } else if (e.code === 'KeyH') {
        toggleMinimalMode();
    }
});

function toggleMinimalMode() {
    document.body.classList.toggle('minimal-mode');
    localStorage.setItem('minimalMode', document.body.classList.contains('minimal-mode'));
}

// Load saved minimal mode preference
if (localStorage.getItem('minimalMode') === 'true') {
    document.body.classList.add('minimal-mode');
}
