const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout",
        gas: "Gas", bal: "Token", connBtn: "Connect MetaMask", logOutMsg: "Session ended.",
        wait: "Processing...", ok: "Success!",
        // Розширені описи
        titleStake: "Staking System",
        infoStake: "This module allows you to lock your ECCYB tokens for a specific period to earn rewards. Early withdrawal is possible but results in the loss of accumulated bonuses.",
        titleTrans: "Asset Transfers",
        infoTrans: "Securely send ECCYB tokens to any wallet address within the BTTC network. Ensure you have enough BTT gas for the transaction to be processed.",
        titleAdmin: "Administrative Tools",
        infoAdmin: "Governance tools: manage emission, burn supply, and distribute gas (BTT) to students for transaction fees."
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вийти",
        gas: "Газ", bal: "Токен", connBtn: "Підключити MetaMask", logOutMsg: "Сесію завершено.",
        wait: "Обробка...", ok: "Успішно!",
        // Розширені описи
        titleStake: "Система Стейкінгу",
        infoStake: "Цей модуль дозволяє блокувати ваші токени ECCYB на певний термін для отримання винагороди. Дострокове виведення можливе, але призведе до втрати накопичених бонусів.",
        titleTrans: "Переказ Активів",
        infoTrans: "Безпечно надсилайте токени ECCYB на будь-яку адресу в мережі BTTC. Переконайтеся, що у вас достатньо BTT для оплати комісії мережі (газу).",
        titleAdmin: "Інструменти Адміністратора",
        infoAdmin: "Керування токеном: емісія нових активів, спалення надлишків та надання газової підтримки (BTT) студентам для оплати комісій."
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
    
    tokenContract = new ethers.Contract(TOKEN_ADDR, ["function balanceOf(address) view returns (uint256)", "function transfer(address, uint256) returns (bool)", "function approve(address, uint256) returns (bool)", "function mint(address, uint256) public", "function burn(uint256) public"], signer);
    stakingContract = new ethers.Contract(STAKING_ADDR, ["function stake(uint256, uint256) external", "function withdraw() external", "function earlyWithdraw() external"], signer);
 
    showUI(true);
    await syncData();

    // ПРАВИЛЬНЕ ВІДОБРАЖЕННЯ АДМІН-ПАНЕЛІ
    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => {
        if (isAdmin) {
            // Використовуємо block для панелей, щоб вони не вирівнювалися в рядок
            el.style.setProperty('display', 'block', 'important');
        } else {
            el.style.setProperty('display', 'none', 'important');
        }
    });
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
        if (document.getElementById('gasBalance')) document.getElementById('gasBalance').innerText = parseFloat(ethers.formatEther(gas)).toFixed(4) + " BTT";
    } catch (e) { console.error(e); }
}

function logout() { window.location.href = "index.html?action=logout"; }
function log(msg) { const c = document.getElementById('console'); if (c) c.innerHTML = `> ${msg}<br>` + c.innerHTML; }

async function handleTx(txPromise) {
    try { log(i18n[currentLang].wait); const tx = await txPromise; await tx.wait(); log(i18n[currentLang].ok); await syncData(); }
    catch (e) { log("Error: " + (e.reason || e.message)); }
}

window.onload = init;
