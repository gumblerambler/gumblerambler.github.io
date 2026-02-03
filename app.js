const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin",
        gas: "Gas Balance", net: "Network", bal: "ECCYB Balance",
        stakeTitle: "Deposit Assets", withdrawTitle: "Withdrawal Management",
        mintTitle: "Emission & Burn", gasTitle: "Gas Support (BTT)",
        apprTitle: "Treasury Allowance",
        btnStake: "Stake Tokens", btnClaim: "Claim Deposit + Bonus",
        btnEarly: "Early Withdrawal", btnMint: "Mint Tokens",
        btnBurn: "Burn Tokens", btnSend: "Execute Transfer",
        btnGas: "Send BTT to Student", btnAppr: "Set Payout Limit",
        wait: "Processing transaction...", ok: "Success! Data updated.",
        err: "Error: ", confirmEarly: "Are you sure? Bonus will be lost.",
        logout: "Logout",
        logOutMsg: "Session ended. Please reconnect via MetaMask if needed."
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін",
        gas: "Баланс Газу", net: "Мережа", bal: "Баланс ECCYB",
        stakeTitle: "Відкрити депозит", withdrawTitle: "Керування виплатами",
        mintTitle: "Емісія та Спалення", gasTitle: "Газова підтримка (BTT)",
        apprTitle: "Ліміт Скарбниці",
        btnStake: "Внести активи", btnClaim: "Забрати з бонусом",
        btnEarly: "Достроковий вивід", btnMint: "Випустити токени",
        btnBurn: "Спалити токени", btnSend: "Виконати переказ",
        btnGas: "Надіслати BTT студенту", btnAppr: "Встановити ліміт",
        wait: "Транзакція в обробці...", ok: "Успіх! Дані оновлено.",
        err: "Помилка: ", confirmEarly: "Ви впевнені? Бонус буде втрачено.",
        logout: "Вийти",
        logOutMsg: "Сесію завершено. Підключіться знову через MetaMask за потреби."
    }
};

let currentLang = localStorage.getItem('eccyb_lang') || 'en';
let signer, tokenContract, stakingContract, userAddress;

async function init() {
    if (!window.ethereum) return alert("Install MetaMask!");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    userAddress = accounts[0];
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

    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'inline' : 'none');
    
    updateUI();
    await syncData();
    log("Connected: " + userAddress.substring(0, 10));
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('eccyb_lang', lang);
    updateUI();
}

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
    try {
        const bal = await tokenContract.balanceOf(userAddress);
        if (document.getElementById('userBalance')) 
            document.getElementById('userBalance').innerText = `${Math.floor(ethers.formatUnits(bal, 18))} ECCYB`;
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const gas = await provider.getBalance(userAddress);
        if (document.getElementById('gasBalance')) 
            document.getElementById('gasBalance').innerText = parseFloat(ethers.formatEther(gas)).toFixed(2) + " BTT";
    } catch (e) { console.error(e); }
}

async function handleTx(txPromise) {
    try {
        log(i18n[currentLang].wait);
        const tx = await txPromise;
        await tx.wait();
        log(i18n[currentLang].ok);
        await syncData();
    } catch (e) { log(i18n[currentLang].err + (e.reason || e.message)); }
}

function log(msg) {
    const c = document.getElementById('console');
    if (c) {
        c.innerHTML = `> ${msg}<br>` + c.innerHTML;
        c.scrollTop = 0;
    }
}

function logout() {
    // У Web3 ми не можемо "змусити" MetaMask розірвати зв'язок, 
    // але ми можемо очистити стан додатка та локальне сховище
    userAddress = null;
    signer = null;
    
    // Очищаємо екран
    const balEl = document.getElementById('userBalance');
    if (balEl) balEl.innerText = "-- ECCYB";
    
    log(i18n[currentLang].logOutMsg);
    
    // Приховуємо адмін-панель
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    
    // Опціонально: перезавантажити сторінку для повної безпеки
    // window.location.reload(); 
}

window.onload = init;
