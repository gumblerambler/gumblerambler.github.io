const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const API_URL = "https://projects.eccyb.org/app/api.php";
// Додати в i18n
// en: linkForgot: "Forgot password?", resetTitle: "Reset Password"
// ua: linkForgot: "Забули пароль?", resetTitle: "Відновлення пароля"
const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout",
        gas: "Gas", bal: "Token", connBtn: "Connect MetaMask", logOutMsg: "Session ended.",
        wait: "Processing...", ok: "Success!", stakeTitle: "Deposit", withdrawTitle: "Withdraw",
        btnStake: "Stake", btnClaim: "Claim", btnEarly: "Early exit", btnSend: "Send",
        titleStake: "Business Investment", capital: "Capital", authTitle: "Login",
        infoStake: "Invest your capital into projects. This module locks tokens for a specific period to earn business revenue. Early exit forfeits the profit.",
        titleTrans: "Asset Transfers",
        infoTrans: "Securely send ECCYB tokens to other business entities within the BTTC network.",
        titleAdmin: "Treasury Control", linkForgot: "Forgot password?", resetTitle: "Reset Password",
        infoAdmin: "Management of the firm's central treasury: audit student balances, distribute initial grants, and gas support."
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вийти",
        gas: "Газ", bal: "Токен", connBtn: "Підключити MetaMask", logOutMsg: "Сесію завершено.",
        wait: "Обробка...", ok: "Успішно!", stakeTitle: "Депозит",  withdrawTitle: "Повернення",
        btnStake: "Вкласти", btnClaim: "Повернути з прибутком", btnEarly: "Повернути без прибутку",
        btnSend: "Перевести",
        titleStake: "Господарські інвестиції", capital: "Капітал", authTitle: "Авторизація",
        infoStake: "Інвестуйте капітал у проекти. Цей модуль блокує токени на певний термін для отримання прибутку. Дострокове виведення скасовує бонус.",
        titleTrans: "Переказ активів",
        infoTrans: "Безпечно надсилайте токени ECCYB іншим підрозділам у мережі BTTC.",
        titleAdmin: "Керування казною", linkForgot: "Забули пароль?", resetTitle: "Відновлення пароля",
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
    //if (!window.ethereum) return;

    if (window.ethereum) {
        // Додаємо відстеження зміни акаунта (щоб викидало при зміні)
        window.ethereum.on('accountsChanged', function (accounts) {
            sessionStorage.removeItem('isLoggedIn'); // Скидаємо сесію
            window.location.reload();
        });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        //const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const loggedIn = sessionStorage.getItem('isLoggedIn');

        if (accounts.length > 0 && loggedIn === 'true') {
            await establishSession(accounts[0]);
            showUI(true);
        } else {
            showUI(false); // Якщо гаманець змінено або не залогінився — показуємо форму входу
        }
    }  
}

async function handleRegister() {
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    
    // Спочатку просимо підключити гаманець, щоб прив'язати його
    if (!userAddress) await connect();

    const response = await fetch(`${API_URL}?action=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email,
            password: pass,
            address: userAddress
        })
    });
    const result = await response.json();
    log(result.message);
}

function toggleAuth(showReg) {
    document.getElementById('loginForm').style.display = showReg ? 'none' : 'block';
    document.getElementById('regForm').style.display = showReg ? 'block' : 'none';
}

async function emailRegister() {
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    if(!email || !pass) return alert("Fill fields");

    // 1. Спочатку підключаємо гаманець
    await connect(); 
    if(!userAddress) return;

    // 2. Відправляємо на бекенд
    const resp = await fetch(`${API_URL}?action=register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password: pass, address: userAddress })
    });
    const res = await resp.json();
    if(res.status === "success") {
        alert("Registered! Now please Login.");
        toggleAuth(false);
    } else {
        alert(res.message);
    }
}

async function emailLogin() {
    const email = document.getElementById('logEmail').value.trim();
    const pass = document.getElementById('logPass').value.trim();

    if (!email || !pass) return;

    try {
        log("Authenticating...");
        const params = new URLSearchParams();
        params.append('action', 'login_email');
        params.append('email', email);
        params.append('password', pass);

        const response = await fetch(API_URL, {
            method: 'POST',
            body: params
        });

        const result = await response.json();
        
        if (result.status === "success") {

            sessionStorage.setItem('isLoggedIn', 'true'); // Позначаємо, що вхід виконано
            // 1. Зберігаємо адресу в глобальну змінну
            userAddress = result.data.wallet_address;
            
            // 2. Запускаємо сесію (підключення до контрактів)
            await establishSession(userAddress);
            showUI(true);
            // 3. ПРИМУСОВО ХОВАЄМО ВХІД І ПОКАЗУЄМО ДАНІ
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dataSection').style.display = 'block';
            
            // 4. Оновлюємо капітал відразу
            await syncWithBackend(userAddress);
            
            log("Logged in as: " + email);
        } else {
            alert(result.message);
        }
    } catch (e) {
        console.error("Login error:", e);
    }
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

async function syncWithBackend(address) {
    if (!address) return;
    try {
        console.log("🚀 Запит капіталу (login_email) для:", address);

        const params = new URLSearchParams();
        params.append('action', 'login_email'); // ВИПРАВЛЕНО НА ПРАВИЛЬНУ ДІЮ
        params.append('address', address.toLowerCase());

        const response = await fetch(API_URL, {
            method: 'POST',
            body: params
        });

        const result = await response.json();
        console.log("✅ Результат сервера:", result);

        if (result.status === "success" && result.data) {
            const capElement = document.getElementById('dbCapital');
            if (capElement) {
                // Виводимо capital_allocated з бази
                const amount = result.data.capital_allocated || "0.00";
                capElement.innerText = parseFloat(amount).toFixed(2) + " ECCYB";
                console.log("💰 Капітал відображено!");
            }
        } else {
            console.warn("⚠️ Дані не знайдено або помилка:", result.message);
        }
    } catch (e) {
        console.error("❌ Помилка зв'язку:", e);
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

async function sendGrant() {
    // Отримуємо значення з полів вводу index.html
    const studentAddr = document.getElementById('targetStudent').value.trim();
    const amount = document.getElementById('grantAmt').value;

    if (!studentAddr || !amount) {
        log("Please enter address and amount");
        return;
    }

    try {
        log("Sending grant to database...");
        const response = await fetch(`${API_URL}?action=give_grant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_address: userAddress, // Ваш гаманець (має збігатися з OWNER_ADDR)
                student_address: studentAddr,
                amount: amount
            })
        });

        const result = await response.json();
        
        if (result.status === "success") {
            log(`Success: ${amount} capital allocated to ${studentAddr.substring(0,8)}...`);
            // Очищуємо поля після успіху
            document.getElementById('grantAmt').value = '';
        } else {
            log("Grant failed: " + result.message);
        }
    } catch (e) {
        log("Network error: " + e.message);
    }
}


function showForgot(show) {
    document.getElementById('loginForm').style.display = show ? 'none' : 'block';
    document.getElementById('forgotForm').style.display = show ? 'block' : 'none';
}

async function handleForgot() {
    const email = document.getElementById('resetEmail').value;
    const resp = await fetch(`${API_URL}?action=forgot_password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email })
    });
    const res = await resp.json();
    if (res.status === "success") {
        alert("Код відправлено (Debug: " + (res.debug_token || "перевірте пошту") + ")");
        document.getElementById('step2Reset').style.display = 'block';
        document.getElementById('btnForgot').style.display = 'none';
        document.getElementById('btnReset').style.display = 'block';
    } else {
        alert(res.message);
    }
}

async function handleReset() {
    const email = document.getElementById('resetEmail').value;
    const token = document.getElementById('resetToken').value;
    const new_password = document.getElementById('newPass').value;

    const resp = await fetch(`${API_URL}?action=reset_password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, token, new_password })
    });
    const res = await resp.json();
    if (res.status === "success") {
        alert("Пароль оновлено!");
        showForgot(false);
    } else {
        alert(res.message);
    }
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
