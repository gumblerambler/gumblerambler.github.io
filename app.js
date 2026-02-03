const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout",
        gas: "Gas", net: "Network", bal: "ECCYB",
        descStake: "Earn rewards by locking your tokens for a selected period.",
        descTrans: "Send ECCYB tokens to other students or wallets instantly.",
        descAdmin: "Control emission, burn tokens, and support students with gas.",
        btnStake: "Go to Staking", btnSend: "Go to Transfers", btnAdmin: "Go to Admin",
        wait: "Processing...", ok: "Success!", logOutMsg: "Session ended.", connBtn: "Connect MetaMask"
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вийти",
        gas: "Газ", net: "Мережа", bal: "Баланс",
        descStake: "Отримуйте винагороду, блокуючи свої токени на обраний термін.",
        descTrans: "Миттєво надсилайте токени ECCYB іншим студентам або на гаманці.",
        descAdmin: "Керуйте емісією, спалюйте токени та підтримуйте студентів газом.",
        btnStake: "Перейти до Стейкінгу", btnSend: "Перейти до Переказів", btnAdmin: "Панель керування",
        wait: "Обробка...", ok: "Успішно!", logOutMsg: "Сесію завершено.", connBtn: "Підключити MetaMask"
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
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    await establishSession(accounts[0]);
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
}

async function syncData() {
    if(!userAddress) return;
    try {
        const bal = await tokenContract.balanceOf(userAddress);
        const val = Math.floor(ethers.formatUnits(bal, 18));
        if (document.getElementById('userBalance')) document.getElementById('userBalance').innerText = val + " ECCYB";
        if (document.getElementById('eccybStat')) document.getElementById('eccybStat').innerText = val;
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const gas = await provider.getBalance(userAddress);
        if (document.getElementById('gasBalance')) document.getElementById('gasBalance').innerText = parseFloat(ethers.formatEther(gas)).toFixed(4) + " BTT";
    } catch (e) { console.error(e); }
}

function logout() {
    window.location.href = "index.html?action=logout";
}

function log(msg) { const c = document.getElementById('console'); if (c) c.innerHTML = `> ${msg}<br>` + c.innerHTML; }
window.onload = init;
