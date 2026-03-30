let adminPass = "";
let playerName = "";
let sessionPoints = 0;
let sessionWordsWon = 0;
let currentSecretWord = "";
let currentGuessWord = [];
let wrongChances = 0;
const MAX_CHANCES = 5;

const appDiv = document.getElementById('app');

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function triggerShake() {
    appDiv.classList.remove('shake', 'error-flash');
    void appDiv.offsetWidth;
    appDiv.classList.add('shake', 'error-flash');
    setTimeout(() => {
        appDiv.classList.remove('shake', 'error-flash');
    }, 400);
}

function showStatus(msg, isError=false) {
    const el = document.getElementById('game-status');
    el.textContent = msg;
    if (isError) el.classList.add('error-text');
    else el.classList.remove('error-text');
}

async function startGame() {
    const nameInput = document.getElementById('player-name').value.trim().toUpperCase();
    if (!nameInput) {
        alert("Please enter a name");
        return;
    }
    playerName = nameInput;
    sessionPoints = 0;
    sessionWordsWon = 0;
    
    document.getElementById('display-name').textContent = playerName;
    updateStatsDisplay();
    switchView('view-play');
    await initRound();
}

async function initRound() {
    wrongChances = 0;
    document.getElementById('round-actions').classList.add('hidden');
    document.getElementById('keyboard').classList.remove('hidden');
    drawKeyboard();
    resetHangmanLines();
    showStatus("Loading word...");

    try {
        const res = await fetch('/api/random_word');
        const data = await res.json();
        if (data.error) {
            showStatus(data.error, true);
            document.getElementById('keyboard').innerHTML = '';
            document.getElementById('round-actions').classList.remove('hidden');
            return;
        }
        currentSecretWord = data.word.toLowerCase();
        currentGuessWord = Array(currentSecretWord.length).fill('_');
        renderWord();
        showStatus("Guess the fruit name!");
    } catch (e) {
        showStatus("Failed to load word.", true);
    }
}

function renderWord() {
    document.getElementById('word-display').textContent = currentGuessWord.join(' ');
}

function drawKeyboard() {
    const kb = document.getElementById('keyboard');
    kb.innerHTML = '';
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    letters.forEach(letter => {
        const btn = document.createElement('button');
        btn.textContent = letter;
        btn.className = 'key';
        btn.onclick = () => handleGuess(letter, btn);
        kb.appendChild(btn);
    });
}

function handleGuess(letter, btnEl) {
    if (btnEl.classList.contains('correct') || btnEl.classList.contains('wrong')) return;

    if (currentSecretWord.includes(letter)) {
        btnEl.classList.add('correct');
        for (let i = 0; i < currentSecretWord.length; i++) {
            if (currentSecretWord[i] === letter) {
                currentGuessWord[i] = letter;
            }
        }
        renderWord();
        showStatus("Correct guess!");
        checkWinRound();
    } else {
        btnEl.classList.add('wrong');
        wrongChances++;
        triggerShake();
        showHangmanPart(wrongChances);
        
        const chancesLeft = MAX_CHANCES - wrongChances;
        showStatus(`Wrong guess! ${chancesLeft} chances remaining.`, true);
        checkLoseRound();
    }
}

function checkWinRound() {
    if (!currentGuessWord.includes('_')) {
        showStatus(`You guessed it! Word: ${currentSecretWord}`);
        sessionWordsWon++;
        
        const points = Math.max(10, 50 - (wrongChances * 10));
        sessionPoints += points;
        
        updateStatsDisplay();
        endRound(true);
    }
}

function checkLoseRound() {
    if (wrongChances >= MAX_CHANCES) {
        showStatus(`You were hanged! The word was: ${currentSecretWord}`, true);
        document.getElementById('word-display').textContent = currentSecretWord.split('').join(' ');
        endRound(false);
    }
}

function endRound(won) {
    const keys = document.querySelectorAll('.key');
    keys.forEach(k => k.onclick = null);
    document.getElementById('round-actions').classList.remove('hidden');
    const nextBtn = document.getElementById('btn-next-round');
    const quitBtn = document.getElementById('btn-quit-game');
    
    if (won) {
        nextBtn.style.display = 'inline-block';
        quitBtn.textContent = 'Quit & Save';
    } else {
        nextBtn.style.display = 'none';
        quitBtn.textContent = 'Game Over - Save Score';
    }
}

function updateStatsDisplay() {
    document.getElementById('display-score').textContent = sessionPoints;
    document.getElementById('display-words').textContent = sessionWordsWon;
}

async function quitGame() {
    showStatus("Saving score...");
    try {
        await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: playerName, points: sessionPoints, words: sessionWordsWon })
        });
    } catch (e) { console.error('Error saving:', e); }

    switchView('view-menu');
}

function resetHangmanLines() {
    document.querySelectorAll('.part').forEach(p => {
        if (typeof p.className.baseVal === "string" && p.className.baseVal.includes('chance-')) {
            p.classList.remove('visible');
        } else {
            p.classList.add('visible');
        }
    });
}

function showHangmanPart(chance) {
    document.querySelectorAll(`.chance-${chance}`).forEach(el => {
        el.classList.add('visible');
    });
}

async function fetchLeaderboard() {
    const tbody = document.getElementById('scores-body');
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    try {
        const res = await fetch('/api/scores');
        const data = await res.json();
        tbody.innerHTML = '';
        if (data.players && data.players.length > 0) {
            data.players.forEach(p => {
                tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.words}</td><td>${p.points}</td></tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3">No players yet.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3">Error loading leaderboard</td></tr>';
    }
}

function adminLogin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "D@rkc0der") {
        adminPass = pass;
        document.getElementById('admin-pass').value = '';
        switchView('view-admin-panel');
    } else {
        triggerShake();
        alert("Unauthorized! Incorrect Password.");
    }
}

async function addWord() {
    const word = document.getElementById('new-word').value.trim();
    if (!word) return;
    try {
        const res = await fetch('/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': adminPass },
            body: JSON.stringify({ word })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Word added!");
            document.getElementById('new-word').value = '';
        } else alert(data.error);
    } catch (e) { console.error(e); }
}

async function deleteWord() {
    const word = document.getElementById('del-word').value.trim();
    if (!word) return;
    try {
        const res = await fetch('/api/words', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': adminPass },
            body: JSON.stringify({ word })
        });
        if (res.ok) {
            alert("Word deleted (if existed)!");
            document.getElementById('del-word').value = '';
        }
    } catch (e) { console.error(e); }
}

async function deletePlayer() {
    const name = document.getElementById('del-player').value.trim();
    if (!name) return;
    try {
        const res = await fetch('/api/scores', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': adminPass },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Player data removed.");
            document.getElementById('del-player').value = '';
        } else alert(data.error || "Error removing player.");
    } catch (e) { console.error(e); }
}

async function viewWordList() {
    const disp = document.getElementById('words-list-display');
    disp.classList.remove('hidden');
    disp.innerHTML = 'Loading...';
    try {
        const res = await fetch('/api/words', { headers: { 'Authorization': adminPass } });
        const data = await res.json();
        if (data.words) {
            disp.innerHTML = data.words.map(w => `<span class="words-list-chip">${w.toUpperCase()}</span>`).join('');
            if (data.words.length === 0) disp.innerHTML = "List is empty.";
        } else disp.innerHTML = "Error loading.";
    } catch (e) { disp.innerHTML = "Error loading."; }
}
