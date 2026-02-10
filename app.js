const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

// Адреса вашого бекенду на s-host (замініть на реальну)
const API_URL = "https://projects.eccyb.org/app/api.php";

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout",
        gas: "Gas", bal: "Capital", connBtn: "Connect MetaMask", logOutMsg: "Session ended.",
        wait: "Processing...", ok: "Success!", stakeTitle: "Deposit", withdrawTitle: "Withdraw",
        btnStake: "Stake", btnClaim: "Claim", btnEarly: "Early exit", btnSend: "Send",
        titleStake: "Business Investment",
        infoStake: "Invest your capital into projects. This module locks tokens for a specific period to earn business revenue. Early exit forfeits the profit.",
        titleTrans: "Asset Transfers",
        infoTrans: "Securely send ECCYB tokens to other business entities within the BTTC network.",
        titleAdmin: "Treasury Control",
        infoAdmin: "Management of the firm's central treasury: audit student balances, distribute initial grants, and gas support."
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вийти",
        gas: "Газ", bal: "Капітал", connBtn: "Підключити MetaMask", logOutMsg: "Сесію завершено.",
        wait: "Обробка...", ok: "Успішно!", stakeTitle: "Депозит",  withdrawTitle: "Повернення",
        btnStake: "Вкласти", btnClaim: "Повернути з прибутком", btnEarly: "Повернути без прибутку",
        btnSend: "Перевести",
        titleStake: "Господарські інвестиції",
        infoStake: "Інвестуйте капітал у проекти. Цей модуль блокує токени на певний термін для отримання прибутку. Дострокове виведення скасовує бонус.",
        titleTrans: "Переказ активів",
        infoTrans: "Безпечно надсилайте токени ECCYB іншим підрозділам у мережі BTTC.",
        titleAdmin: "Керування казною",
        infoAdmin: "Інструменти фінансового директора: аудит балансів студентів, видача початкових грантів та підтримка газом (BTT)."
    }
};

let currentLang = localStorage.getItem('eccyb_lang') || 'en';
let signer, tokenContract, stakingContract, userAddress;

async function init() {
    updateUI();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'logout') {
        showUI(false);
        log(i18n[currentLang].logOutMsg);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    if (!window.ethereum) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length > 0) await establishSession(accounts[0].address);
    else showUI(false);
}

async function connect() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        await establishSession(accounts[0]);
    } catch (e) { log("Connection rejected"); }
}

async function establishSession(addr) {
    userAddress = addr;
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    
    tokenContract = new ethers.Contract(TOKEN_ADDR, [
        "function balanceOf(address) view returns (uint256)", 
        "function transfer(address, uint256) returns (bool)", 
        "function approve(address, uint256) returns (bool)", 
        "function mint(address, uint256) public", 
        "function burn(uint256) public"
    ], signer);
    
    stakingContract = new ethers.Contract(STAKING_ADDR, [
        "function stake(uint256, uint256) external", 
        "function withdraw() external", 
        "function earlyWithdraw() external"
    ], signer);

    // Синхронізація з MySQL бекендом
    await syncWithBackend(userAddress);
 
    showUI(true);
    await syncData();

    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.setProperty('display', isAdmin ? 'block' : 'none', 'important');
    });
}

// Нова функція для роботи з PHP API
async function syncWithBackend(address) {
    try {
        const response = await fetch(`${API_URL}?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: address })
        });
        const result = await response.json();
        if (result.status === "success") {
            console.log("MySQL sync ok:", result.data);
        }
    } catch (e) {
        console.warn("Backend unavailable. Working in blockchain-only mode.");
    }
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
    if(!userAddress) return;
    try {
        const bal = await tokenContract.balanceOf(userAddress);
        const val = Math.floor(ethers.formatUnits(bal, 18));
        if (document.getElementById('eccybStat')) document.getElementById('eccybStat').innerText = val;
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const gas = await provider.getBalance(userAddress);
        if (document.getElementById('gasBalance')) document.getElementById('gasBalance').innerText = parseFloat(ethers.formatEther(gas)).toFixed(4);
    } catch (e) { console.error(e); }
}

function logout() { window.location.href = "index.html?action=logout"; }
function log(msg) { const c = document.getElementById('console'); if (c) c.innerHTML = `> ${msg}<br>` + c.innerHTML; }

async function handleTx(txPromise) {
    try { 
        log(i18n[currentLang].wait); 
        const tx = await txPromise; 
        await tx.wait(); 
        log(i18n[currentLang].ok); 
        await syncData(); 
    } catch (e) { 
        log("Error: " + (e.reason || e.message)); 
    }
}

window.onload = init;
