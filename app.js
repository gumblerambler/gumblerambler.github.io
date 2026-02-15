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
        btnSignIn: "Sign In", btnReg: "Register & Connect", linkRegister: "Register",
        linkLogin: "Login", regNote: "*Registration will link your MetaMask wallet.",
        linkForgot: "Forgot password?", resetTitle: "Reset Password",
        withdrawCap: "Withdraw Capital", btnWithdraw: "Transfer to Wallet"
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вихід",
        gas: "Газ", bal: "Токен", connBtn: "Підключити MetaMask", logOutMsg: "Сесію завершено.",
        wait: "Обробка...", ok: "Успішно!", stakeTitle: "Депозит", withdrawTitle: "Виведення",
        btnStake: "Інвестувати", btnClaim: "Забрати прибуток", btnEarly: "Достроковий вихід", btnSend: "Відправити",
        titleStake: "Бізнес Інвестиції", capital: "Капітал", authTitle: "Корпоративний доступ",
        btnSignIn: "Увійти", btnReg: "Реєстрація", linkRegister: "Зареєструватися",
        linkLogin: "Увійти", regNote: "*Реєстрація прив'яже ваш гаманець MetaMask.",
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
    const auth = document.getElementById('authSection');
    const nav = document.getElementById('mainNav');
    const data = document.getElementById('dataSection');
    if (auth) auth.style.display = connected ? 'none' : 'block';
    if (nav) nav.style.display = connected ? 'flex' : 'none';
    if (data) data.style.display = connected ? 'block' : 'none';
}

async function establishSession(addr) {
    userAddress = addr;
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    tokenContract = new ethers.Contract(TOKEN_ADDR, [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function decimals() view returns (uint8)"
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

async function syncWithBackend(address) {
    if (!address) return;
    try {
        const params = new URLSearchParams();
        params.append('action', 'login'); // Отримуємо дані профілю за адресою
        params.append('address', address.toLowerCase());

        const response = await fetch(API_URL, { method: 'POST', body: params });
        const result = await response.json();
        
        if (result.status === "success" && result.data) {
            const capElement = document.getElementById('dbCapital');
            if (capElement) {
                const amount = result.data.capital_allocated || "0.00";
                capElement.innerText = parseFloat(amount).toFixed(2) + " ECCYB";
            }
        }
    } catch (e) { console.error("Sync error:", e); }
}

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
            showUI(true); // МИТТЄВИЙ ПЕРЕХІД
            log("Logged in: " + email);
        } else {
            alert(result.message);
        }
    } catch (e) { console.error("Login error:", e); }
}

async function emailRegister() {
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    if (!email || !pass) return alert("Fill fields");

    if (!window.ethereum) return alert("Install MetaMask");
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const addr = accounts[0];

    try {
        const params = new URLSearchParams();
        params.append('action', 'register');
        params.append('email', email);
        params.append('password', pass);
        params.append('address', addr);

        const response = await fetch(API_URL, { method: 'POST', body: params });
        const result = await response.json();
        
        if (result.status === "success") {
            alert("Success! Now Login.");
            toggleAuth(false);
        } else {
            alert(result.message);
        }
    } catch (e) { console.error("Reg error:", e); }
}

async function requestWithdraw() {
    const amt = document.getElementById('withdrawAmt').value;
    if (!amt || amt <= 0) return alert("Enter amount");

    try {
        const params = new URLSearchParams();
        params.append('action', 'withdraw_request');
        params.append('address', userAddress.toLowerCase());
        params.append('amount', amt);

        const response = await fetch(API_URL, { method: 'POST', body: params });
        const result = await response.json();

        if (result.status === "success") {
            alert("Request sent! Admin will transfer tokens.");
            await syncWithBackend(userAddress);
        } else {
            alert(result.message);
        }
    } catch (e) { console.error(e); }
}

function toggleAuth(showReg) {
    document.getElementById('loginForm').style.display = showReg ? 'none' : 'block';
    document.getElementById('regForm').style.display = showReg ? 'block' : 'none';
}

function showForgot(show) {
    document.getElementById('loginForm').style.display = show ? 'none' : 'block';
    document.getElementById('forgotForm').style.display = show ? 'block' : 'none';
}

async function handleForgot() {
    const email = document.getElementById('resetEmail').value;
    const params = new URLSearchParams();
    params.append('action', 'forgot_password');
    params.append('email', email);

    const resp = await fetch(API_URL, { method: 'POST', body: params });
    const res = await resp.json();
    if (res.status === "success") {
        alert("Код відправлено (Debug: " + (res.debug_token || "перевірте пошту") + ")");
        document.getElementById('step2Reset').style.display = 'block';
        document.getElementById('btnForgot').style.display = 'none';
        document.getElementById('btnReset').style.display = 'block';
    } else { alert(res.message); }
}

async function handleReset() {
    const email = document.getElementById('resetEmail').value;
    const token = document.getElementById('resetToken').value;
    const new_password = document.getElementById('newPass').value;

    const params = new URLSearchParams();
    params.append('action', 'reset_password');
    params.append('email', email);
    params.append('token', token);
    params.append('new_password', new_password);

    const resp = await fetch(API_URL, { method: 'POST', body: params });
    const res = await resp.json();
    if (res.status === "success") {
        alert("Пароль оновлено!");
        showForgot(false);
    } else { alert(res.message); }
}

async function syncData() {
    if (!userAddress) return;
    try {
        const bal = await tokenContract.balanceOf(userAddress);
        const dec = await tokenContract.decimals();
        document.getElementById('eccybStat').innerText = ethers.formatUnits(bal, dec);
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const gas = await provider.getBalance(userAddress);
        document.getElementById('gasBalance').innerText = ethers.formatEther(gas).slice(0, 6);
    } catch (e) { console.error("Blockchain sync error", e); }
}

function updateLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = i18n[currentLang][key] || key;
    });
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    updateLang();
}

function log(msg) {
    const c = document.getElementById('console');
    if (c) c.innerHTML = `> ${msg}<br>` + c.innerHTML;
}

window.onload = init;
