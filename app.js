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
    if (!window.ethereum) return;
    
    // Перевіряємо, чи вже є дозволені акаунти
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();

    if (accounts.length > 0) {
        await establishSession(accounts[0]);
    } else {
        showUI(false); // Показуємо тільки кнопку Connect
    }
    updateUI();
}

async function connect() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        await establishSession({address: accounts[0]});
    } catch (e) {
        log("Connection failed: " + e.message);
    }
}

async function establishSession(account) {
    userAddress = account.address || account;
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    tokenContract = new ethers.Contract(TOKEN_ADDR, [/* ABI як раніше */], signer);
    stakingContract = new ethers.Contract(STAKING_ADDR, [/* ABI як раніше */], signer);

    showUI(true); // Показуємо меню та баланси
    await syncData();
    
    // Перевірка адміна
    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'inline' : 'none');
}

function showUI(connected) {
    document.getElementById('authSection').style.display = connected ? 'none' : 'block';
    document.getElementById('mainNav').style.display = connected ? 'flex' : 'none';
    document.getElementById('dataSection').style.display = connected ? 'block' : 'none';
}

function logout() {
    userAddress = null;
    signer = null;
    
    // Очищення полів
    if (document.getElementById('userBalance')) document.getElementById('userBalance').innerText = "-- ECCYB";
    if (document.getElementById('gasBalance')) document.getElementById('gasBalance').innerText = "-- BTT";
    
    showUI(false);
    log(i18n[currentLang].logOutMsg);
}

window.onload = init;
