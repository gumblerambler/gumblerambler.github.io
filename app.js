const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout",
        gas: "Gas Balance", net: "Network", bal: "ECCYB Balance",
        stakeTitle: "Deposit Assets", withdrawTitle: "Withdrawal",
        mintTitle: "Emission & Burn", gasTitle: "Gas Support (BTT)",
        btnStake: "Stake Tokens", btnClaim: "Claim + Bonus", btnEarly: "Early Exit",
        btnMint: "Mint", btnBurn: "Burn", btnSend: "Send Assets", btnGas: "Send BTT",
        wait: "Processing...", ok: "Success!", logOutMsg: "Session ended. Data cleared.",
        connBtn: "Connect MetaMask"
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вийти",
        gas: "Баланс Газу", net: "Мережа", bal: "Баланс ECCYB",
        stakeTitle: "Відкрити депозит", withdrawTitle: "Виплата",
        mintTitle: "Емісія / Спалення", gasTitle: "Підтримка Газом",
        btnStake: "Внести активи", btnClaim: "Забрати з бонусом", btnEarly: "Вихід без %",
        btnMint: "Випустити", btnBurn: "Спалити", btnSend: "Надіслати", btnGas: "Надіслати BTT",
        wait: "Обробка...", ok: "Успішно!", logOutMsg: "Сесію завершено. Дані очищено.",
        connBtn: "Підключити MetaMask"
    }
};

let currentLang = localStorage.getItem('eccyb_lang') || 'en';
let signer, tokenContract, stakingContract, userAddress;

async function init() {
    updateUI();
    if (!window.ethereum) return;

    // ПЕРЕВІРКА ПАРАМЕТРА ВИХОДУ
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'logout') {
        // Якщо ми щойно перейшли сюди для виходу:
        showUI(false);
        log(i18n[currentLang].logOutMsg);
        
        // Очищаємо параметри в адресному рядку для краси
        window.history.replaceState({}, document.title, window.location.pathname);
        return; // Зупиняємо подальшу ініціалізацію
    }

    // Звичайна логіка підключення
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();
    
    if (accounts.length > 0) {
        await establishSession(accounts[0].address);
    } else {
        showUI(false);
    }
}

async function connect() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        await establishSession(accounts[0]);
    } catch (e) { log("Connection error"); }
}

async function establishSession(addr) {
    userAddress = addr;
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    tokenContract = new ethers.Contract(TOKEN_ADDR, ["function balanceOf(address) view returns (uint256)", "function transfer(address, uint256) returns (bool)", "function approve(address, uint256) returns (bool)", "function mint(address, uint256) public", "function burn(uint256) public"], signer);
    stakingContract = new ethers.Contract(STAKING_ADDR, ["function stake(uint256, uint256) external", "function withdraw() external", "function earlyWithdraw() external"], signer);
    
    showUI(true);
    await syncData();
    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'inline' : 'none');
}

function showUI(connected) {
    document.getElementById('authSection').style.display = connected ? 'none' : 'block';
    document.getElementById('mainNav').style.display = connected ? 'flex' : 'none';
    document.getElementById('dataSection').style.display = connected ? 'block' : 'none';
}

function setLang(lang) { currentLang = lang; localStorage.setItem('eccyb_lang', lang); updateUI(); }

function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) el.innerText = i18n[currentLang][key];
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === currentLang);
    });
}

async function syncData() {
    if (!userAddress) return;
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);

        // 1. Оновлення балансу Токенів (ECCYB)
        const bal = await tokenContract.balanceOf(userAddress);
        const balEl = document.getElementById('userBalance');
        if (balEl) {
            balEl.innerText = `${Math.floor(ethers.formatUnits(bal, 18))} ECCYB`;
        }
        
        // 2. Оновлення балансу Газу (BTT)
        const gas = await provider.getBalance(userAddress);
        const gasEl = document.getElementById('gasBalance');
        if (gasEl) {
            gasEl.innerText = parseFloat(ethers.formatEther(gas)).toFixed(4) + " BTT";
        }
    } catch (e) { 
        console.error("Sync Error:", e); 
    }
}

async function handleTx(txPromise) {
    try { log(i18n[currentLang].wait); const tx = await txPromise; await tx.wait(); log(i18n[currentLang].ok); await syncData(); }
    catch (e) { log("Error: " + (e.reason || e.message)); }
}

function logout() {
    // 1. Очищаємо локальне сховище, щоб при переході на index.html 
    // скрипт не намагався автоматично підключитися знову
    localStorage.removeItem('eccyb_connected'); // якщо ви використовували прапорець автопідключення
    
    // 2. Додаємо в URL параметр, щоб index.html знав, що треба показати повідомлення про вихід
    // Це спрацює як: https://ваша-адреса.github.io/index.html?action=logout
    const homeUrl = "index.html?action=logout";
    
    // 3. Переспрямовуємо
    window.location.href = homeUrl;
}

function log(msg) { const c = document.getElementById('console'); if (c) c.innerHTML = `> ${msg}<br>` + c.innerHTML; }
window.onload = init;
