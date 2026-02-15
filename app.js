const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const API_URL = "https://projects.eccyb.org/app/api.php";

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout",
        gas: "Gas", bal: "Token", connBtn: "Connect MetaMask", logOutMsg: "Session ended.",
        wait: "Processing...", ok: "Success!", stakeTitle: "Deposit", withdrawTitle: "Withdraw",
        btnStake: "Stake", btnClaim: "Claim", btnEarly: "Early exit", btnSend: "Send",
        titleStake: "Business Investment", capital: "Capital", authTitle: "Corporate Access",
        btnSignIn: "Sign In", btnReg: "Register", linkRegister: "Join",
        linkLogin: "Login", regNote: "*MetaMask link required.",
        linkForgot: "Forgot password?", resetTitle: "Reset Password",
        withdrawCap: "Withdraw Capital", btnWithdraw: "Request Tokens"
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вихід",
        gas: "Газ", bal: "Токен", connBtn: "Підключити MetaMask", logOutMsg: "Сесію завершено.",
        wait: "Обробка...", ok: "Успішно!", stakeTitle: "Депозит", withdrawTitle: "Виведення",
        btnStake: "Інвестувати", btnClaim: "Забрати прибуток", btnEarly: "Достроковий вихід", btnSend: "Відправити",
        titleStake: "Бізнес Інвестиції", capital: "Капітал", authTitle: "Корпоративний доступ",
        btnSignIn: "Увійти", btnReg: "Реєстрація", linkRegister: "Зареєструватися",
        linkLogin: "Увійти", regNote: "*Потрібна прив'язка MetaMask.",
        linkForgot: "Забули пароль?", resetTitle: "Відновлення пароля",
        withdrawCap: "Вивести капітал", btnWithdraw: "Вивести на гаманець"
    }
};

let currentLang = localStorage.getItem('lang') || 'ua';
let userAddress, signer, tokenContract, stakingContract;

async function init() {
    updateLang();
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await establishSession(accounts[0]);
            showUI(true);
        } else {
            showUI(false);
        }
    }
}

function showUI(connected) {
    document.getElementById('authSection').style.display = connected ? 'none' : 'block';
    document.getElementById('mainNav').style.display = connected ? 'flex' : 'none';
    document.getElementById('dataSection').style.display = connected ? 'block' : 'none';
}

async function establishSession(addr) {
    userAddress = addr;
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    
    tokenContract = new ethers.Contract(TOKEN_ADDR, [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function decimals() view returns (uint8)",
        "function approve(address, uint256) returns (bool)"
    ], signer);

    stakingContract = new ethers.Contract(STAKING_ADDR, [
        "function stake(uint256) external",
        "function claimReward() external",
        "function withdraw() external",
        "function getStakeInfo(address) view returns (uint256, uint256)"
    ], signer);

    await syncWithBackend(userAddress);
    await syncData();
}

// ПРАВИЛЬНИЙ SYNC З БЕКЕНДОМ
async function syncWithBackend(address) {
    if (!address) return;
    try {
        const params = new URLSearchParams();
        params.append('action', 'login'); // Використовуємо login для отримання даних профілю
        params.append('address', address.toLowerCase());

        const response = await fetch(API_URL, { method: 'POST', body: params });
        const result = await response.json();
        
        if (result.status === "success" && result.data) {
            const capElement = document.getElementById('dbCapital');
            if (capElement) {
                capElement.innerText = parseFloat(result.data.capital_allocated || 0).toFixed(2) + " ECCYB";
            }
        }
    } catch (e) { console.error("Backend sync error", e); }
}

// ВИПРАВЛЕНИЙ ЛОГІН (МИТТЄВИЙ)
async function emailLogin() {
    const email = document.getElementById('logEmail').value.trim();
    const pass = document.getElementById('logPass').value.trim();
    if (!email || !pass) return;

    try {
        const params = new URLSearchParams();
        params.append('action', 'login_email');
        params.append('email', email);
        params.append('password', pass);

        const response = await fetch(API_URL, { method: 'POST', body: params });
        const result = await response.json();
        
        if (result.status === "success") {
            await establishSession(result.data.wallet_address);
            showUI(true); // Показуємо кабінет відразу
        } else {
            alert(result.message);
        }
    } catch (e) { console.error(e); }
}

// БЛОКЧЕЙН ФУНКЦІЇ (ПОВЕРНУТО)
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

async function stakeTokens() {
    const amt = ethers.parseUnits(document.getElementById('stakeAmt').value, 18);
    await handleTx(tokenContract.approve(STAKING_ADDR, amt));
    await handleTx(stakingContract.stake(amt));
}

async function claimReward() { await handleTx(stakingContract.claimReward()); }
async function earlyExit() { await handleTx(stakingContract.withdraw()); }

async function transferTokens() {
    const to = document.getElementById('transferTo').value;
    const amt = ethers.parseUnits(document.getElementById('transferAmt').value, 18);
    await handleTx(tokenContract.transfer(to, amt));
}

async function syncData() {
    if (!userAddress) return;
    try {
        const bal = await tokenContract.balanceOf(userAddress);
        document.getElementById('eccybStat').innerText = ethers.formatUnits(bal, 18);
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const gas = await provider.getBalance(userAddress);
        document.getElementById('gasBalance').innerText = ethers.formatEther(gas).slice(0, 6) + " BTT";

        const stake = await stakingContract.getStakeInfo(userAddress);
        const stakedField = document.getElementById('stakedAmt');
        if (stakedField) stakedField.innerText = ethers.formatUnits(stake[0], 18);
    } catch (e) { console.error(e); }
}

// ПІДТРИМКА МОВ ТА ІНШЕ
function updateLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = i18n[currentLang][el.getAttribute('data-i18n')] || el.innerText;
    });
}

function setLang(l) { currentLang = l; localStorage.setItem('lang', l); updateLang(); }
function log(msg) { 
    const c = document.getElementById('console'); 
    if (c) c.innerHTML = `> ${msg}<br>${c.innerHTML}`; 
}
function toggleAuth(reg) {
    document.getElementById('loginForm').style.display = reg ? 'none' : 'block';
    document.getElementById('regForm').style.display = reg ? 'block' : 'none';
}

window.onload = init;
