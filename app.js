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
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', function () {
            sessionStorage.removeItem('isLoggedIn');
            window.location.reload();
        });

        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true';

        if (accounts.length > 0 && loggedIn) {
            const user = accounts[0].toLowerCase();
            await establishSession(user);
            showUI(true);
        } else {
            showUI(false);
        }
    }
}

async function emailLogin() {
    const email = document.getElementById('logEmail').value.trim();
    const pass = document.getElementById('logPass').value.trim();

    if (!email || !pass) return;

    try {
        log("Checking credentials...");
        
        // Отримуємо поточну адресу з MetaMask
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const currentMetaMaskAddr = accounts[0]?.toLowerCase();

        if (!currentMetaMaskAddr) {
            alert("Please connect MetaMask first");
            return;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login_email', email, password: pass })
        });

        const result = await response.json();

        if (result.status === "success") {
            const dbWalletAddr = result.data.wallet_address.toLowerCase();

            // ПЕРЕВІРКА: чи збігається активний гаманець з гаманцем у БД
            if (currentMetaMaskAddr !== dbWalletAddr) {
                alert(`This account is linked to another wallet: ${dbWalletAddr.slice(0, 6)}...${dbWalletAddr.slice(-4)}. Please switch your MetaMask account.`);
                return; // Блокуємо вхід
            }

            // Якщо все добре — пускаємо
            sessionStorage.setItem('isLoggedIn', 'true');
            await establishSession(result.data.wallet_address);
            showUI(true);
            log("Welcome, " + email);
        } else {
            alert(result.message);
        }
    } catch (e) {
        console.error("Login error:", e);
    }
}

async function syncWithBackend(address) {
    if (!address) return;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'login', // Екшн для отримання капіталу
                address: address.toLowerCase() 
            })
        });

        const result = await response.json();
        if (result.status === "success" && result.data) {
            const cap = document.getElementById('dbCapital');
            if (cap) cap.innerText = parseFloat(result.data.capital_allocated || 0).toFixed(2) + " ECCYB";
        }
    } catch (e) { console.error(e); }
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
    // 1. Збираємо дані з форми
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    const fullName = document.getElementById('regFullName').value.trim();
    const groupName = document.getElementById('regGroup').value.trim();

    // Перевірка на заповнення полів (фронтенд)
    if(!fullName || !groupName || !email || !pass) {
        alert("Будь ласка, заповніть всі поля форми.");
        return;
    }

    try {
        // 2. Викликаємо MetaMask ТУТ
        if (!window.ethereum) {
            alert("MetaMask не знайдено! Встановіть розширення.");
            return;
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const walletAddr = accounts[0]; // Отримуємо адресу гаманця

        log("Реєстрація користувача...");

        // 3. Відправляємо дані на сервер
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                action: 'register', 
                email: email, 
                password: pass, 
                address: walletAddr, 
                full_name: fullName, 
                group_name: groupName 
            })
        });

        const res = await resp.json();

        // 4. Обробляємо результат
        if (res.status === "success") {
            alert("Реєстрація успішна! Тепер увійдіть під своїм логіном.");
            toggleAuth(false); // Повертаємо користувача на форму логіну
        } else {
            alert("Помилка БД: Сервер відхилив реєстрацію (можливо, такий email вже існує).");
        }

    } catch (e) {
        console.error(e);
        log("Помилка: " + e.message);
        alert("Дію скасовано або виникла помилка підключення до MetaMask.");
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

async function fetchUserData() {
    if (!userAddress) return;
    try {
        // Запит до вашого api.php (кафедра ІТ ЗІЕІТ)
        const response = await fetch(`${API_URL}?action=get_user_data&address=${userAddress}`);
        const data = await response.json();
        
        if (data.status === "success" || data.capital !== undefined) {
            const capElem = document.getElementById('dbCapital');
            if (capElem) {
                capElem.innerText = parseFloat(data.capital).toFixed(2);
            }
        }
    } catch (err) {
        console.error("Помилка отримання капіталу:", err);
    }
}

async function updateDBCapital() {
    try {
        const resp = await fetch(`${API_URL}?action=get_user_data&address=${userAddress}`);
        const data = await resp.json();
        if (data && data.capital !== undefined) {
            // Оновлюємо текст на сторінці
            const capElem = document.getElementById('dbCapital');
            if (capElem) capElem.innerText = parseFloat(data.capital).toFixed(2);
        }
    } catch (e) {
        console.error("Не вдалося оновити капітал:", e);
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

function logout() {
    // 1. Очищуємо мітку входу, яку ми додавали для безпеки
    sessionStorage.removeItem('isLoggedIn');
    
    // 2. Скидаємо глобальну адресу
    userAddress = null;
    
    // 3. Перемикаємо інтерфейс назад на форму логіну
    showUI(false);
    
    // 4. Очищуємо консоль або статус
    log(i18n[currentLang].logOutMsg);
    
    // 5. Опціонально: перезавантажуємо сторінку, щоб повністю очистити пам'ять
    window.location.href = "index.html"; 
    // або просто:
    // window.location.reload();
}
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
