const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0xB704E16DDc2c4D4aB1d0852669aECe1da8448fc8";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const API_URL = "https://projects.eccyb.org/app/api.php";

// Дозволяємо запити з вашого GitHub Pages
header("Access-Control-Allow-Origin: https://gumblerambler.github.io");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Обробка preflight-запиту (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

const i18n = {
    en: {
        home: "Home", stake: "Staking", wallet: "Transfer", admin: "Admin", logout: "Logout", game: "Gomoku",
        gas: "Gas", bal: "Token", connBtn: "Connect MetaMask", logOutMsg: "Session ended.",
        wait: "Processing...", ok: "Success!", stakeTitle: "Deposit", withdrawTitle: "Withdraw",
        btnStake: "Stake", btnClaim: "Claim", btnEarly: "Early exit", btnSend: "Send",
        titleName: "User's dashboard",
        infoName: "User Info from Database:",
        titleStake: "Business Investment", capital: "Capital", authTitle: "Login",
        infoStake: "Invest your capital into projects. This module locks tokens for a specific period to earn business revenue. Early exit forfeits the profit.",
        titleTrans: "Asset Transfers",
        infoTrans: "Securely send ECCYB tokens to other business entities within the BTTC network.",
        titleGame: "Gamification",
        infoGame: "Improve your softskills by beating the computer in Gomoku.",
        titleAdmin: "Treasury Control", linkForgot: "Forgot password?", resetTitle: "Reset Password",
        infoAdmin: "Management of the firm's central treasury: audit student balances, distribute initial grants, and gas support."
    },
    ua: {
        home: "Головна", stake: "Стейкінг", wallet: "Переказ", admin: "Адмін", logout: "Вийти", game: "Гра 5-в-ряд",
        gas: "Газ", bal: "Токен", connBtn: "Підключити MetaMask", logOutMsg: "Сесію завершено.",
        wait: "Обробка...", ok: "Успішно!", stakeTitle: "Депозит", withdrawTitle: "Повернення",
        btnStake: "Вкласти", btnClaim: "Повернути з прибутком", btnEarly: "Повернути без прибутку",
        btnSend: "Перевести",
        titleName: "Панель користувача",
        infoName: "Дані користувача з БД:",
        titleStake: "Господарські інвестиції", capital: "Капітал", authTitle: "Авторизація",
        infoStake: "Інвестуйте капітал у проекти. Цей модуль блокує токени на певний термін для отримання прибутку. Дострокове виведення скасовує бонус.",
        titleTrans: "Переказ активів",
        infoTrans: "Безпечно надсилайте токени ECCYB іншим підрозділам у мережі BTTC.",
        titleGame: "Гейміфікація",
        infoGame: "Покращуйте свої навички, перемагаючи комп'ютер у грі Gomoku.",        
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
    const email = document.getElementById('logEmail')?.value.trim();
    const pass = document.getElementById('logPass')?.value.trim();

    if (!email || !pass) return;

    try {
        log("Checking credentials...");
        
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

            if (currentMetaMaskAddr !== dbWalletAddr) {
                alert(`This account is linked to another wallet: ${dbWalletAddr.slice(0, 6)}...${dbWalletAddr.slice(-4)}. Please switch your MetaMask account.`);
                return;
            }

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

async function reconnectWallet() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
            const newAddress = accounts[0].toLowerCase();
            const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
            
            if (loggedIn) {
                await establishSession(newAddress);
            } else {
                await connect();
            }
        }
    } catch (e) {
        console.error("Reconnect error:", e);
    }
}

async function syncWithBackend(address) {
    if (!address) return;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'login',
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
    const email = document.getElementById('regEmail')?.value;
    const pass = document.getElementById('regPass')?.value;
    
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
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('regForm');
    if (loginForm) loginForm.style.display = showReg ? 'none' : 'block';
    if (regForm) regForm.style.display = showReg ? 'block' : 'none';
}

async function emailRegister() {
    const email = document.getElementById('regEmail')?.value.trim();
    const pass = document.getElementById('regPass')?.value.trim();
    const fullName = document.getElementById('regFullName')?.value.trim();
    const groupName = document.getElementById('regGroup')?.value.trim();

    if(!fullName || !groupName || !email || !pass) {
        alert("Будь ласка, заповніть всі поля форми.");
        return;
    }

    try {
        if (!window.ethereum) {
            alert("MetaMask не знайдено! Встановіть розширення.");
            log("MetaMask не знайдено! Встановіть розширення.");
            return;
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);

        if (!accounts || accounts.length === 0) {
            log("Немає підключеного гаманця. Будь ласка, підключіть MetaMask.");
            return;
        }
        
        const walletAddr = accounts[0];
        log("Гаманець підключено: " + walletAddr);
        log("Реєстрація користувача...");

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

        if (res.status === "success") {
            log("Реєстрація успішна! Тепер увійдіть під своїм логіном.");
            toggleAuth(false);
        } else {
            log("Помилка БД: Сервер відхилив реєстрацію (можливо, такий email вже існує).");
        }

    } catch (e) {
        console.error(e);
        log("Помилка: " + e.message);
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
        "function allowance(address owner, address spender) view returns (uint256)",
        "function mint(address, uint256) public", 
        "function burn(uint256) public"
    ], signer);
    
    stakingContract = new ethers.Contract(STAKING_ADDR, [
        "function stake(uint256 amount) external",
        "function withdraw() external", 
        "function earlyWithdraw() external",
        "function pendingReward(address user) view returns (uint256)"
    ], signer);

    await syncWithBackend(userAddress);
    showUI(true);
    await syncData();

    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.setProperty('display', isAdmin ? 'block' : 'none', 'important');
    });
}

function showUI(connected) {
    const authSection = document.getElementById('authSection');
    const mainNav = document.getElementById('mainNav');
    const dataSection = document.getElementById('dataSection');

    if (authSection) authSection.style.display = connected ? 'none' : 'block';
    if (mainNav) mainNav.style.display = connected ? 'flex' : 'none';
    if (dataSection) dataSection.style.display = connected ? 'block' : 'none';
}

function setLang(lang) { currentLang = lang; localStorage.setItem('eccyb_lang', lang); updateUI(); }

function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang] && i18n[currentLang][key]) {
            el.innerText = i18n[currentLang][key];
        }
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === currentLang);
    });
}

async function getPendingReward() {
    if (!userAddress || !stakingContract) return "0";
    try {
        const rewardWei = await stakingContract.pendingReward(userAddress);
        return ethers.formatUnits(rewardWei, 18);
    } catch (e) {
        return "0";
    }
}

async function syncData() {
    if(!userAddress) return;
    try {
        await updateDBCapitalDirectly();
        if (tokenContract) {
            const bal = await tokenContract.balanceOf(userAddress);
            const val = Math.floor(ethers.formatUnits(bal, 18));
            const statElem = document.getElementById('eccybStat');
            if (statElem) statElem.innerText = val;
        }
        
        if (window.ethereum) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const gas = await provider.getBalance(userAddress);
            const gasElem = document.getElementById('gasBalance');
            if (gasElem) gasElem.innerText = parseFloat(ethers.formatEther(gas)).toFixed(4);
        }

        const pending = await getPendingReward();
        const pendingElem = document.getElementById('pendingReward');
        if (pendingElem) {
            pendingElem.innerText = parseFloat(pending).toFixed(4) + " ECCYB";
        }
    } catch (e) { console.error("Sync data error:", e); }
}

async function sendGrant() {
    const studentAddr = document.getElementById('targetStudent')?.value.trim();
    const amount = document.getElementById('grantAmt')?.value;

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
                admin_address: userAddress,
                student_address: studentAddr,
                amount: amount
            })
        });

        const result = await response.json();
        
        if (result.status === "success") {
            log(`Success: ${amount} capital allocated to ${studentAddr.substring(0,8)}...`);
            const grantInput = document.getElementById('grantAmt');
            if (grantInput) grantInput.value = '';
        } else {
            log("Grant failed: " + result.message);
        }
    } catch (e) {
        log("Network error: " + e.message);
    }
}

async function updateDBCapitalDirectly() {
    if (!userAddress) return;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'get_user_data', 
                address: userAddress.toLowerCase() 
            })
        });
        
        const result = await response.json();
        const el = document.getElementById('dbCapital');
        const name = document.getElementById('userName');
        const group = document.getElementById('userGroup');
        const addrElem = document.getElementById('userAddress');

        if (name && result.name) name.innerText = result.name;
        if (group && result.group) group.innerText = result.group;
        if (addrElem) addrElem.innerText = userAddress;

        if (result.status === "success" && result.capital !== undefined) {
            const cleanCapital = parseFloat(result.capital).toFixed(2);
            if (el) el.innerText = cleanCapital + " ECCYB";
            log("User "+(result.name || '')+" from "+(result.group || '')+" with wallet "+userAddress);
            console.log("Капітал оновлено: " + cleanCapital);
        } else {
            console.error("Помилка API:", result.error || result.message);
        }
    } catch (err) {
        console.error("Мережева помилка при оновленні капіталу:", err);
    }
}

async function addNetworkAndToken() {
    try {
        if (!window.ethereum) {
            alert("MetaMask is not installed!");
            return;
        }

        const bttcChainId = '0xc7';
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        if (currentChainId !== bttcChainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: bttcChainId }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: bttcChainId,
                            chainName: 'BitTorrent Chain Mainnet',
                            nativeCurrency: { 
                                name: 'BitTorrent', 
                                symbol: 'BTT', 
                                decimals: 18 
                            },
                            rpcUrls: ['https://rpc.bt.io'],
                            blockExplorerUrls: ['https://bttcscan.com']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }

        await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: TOKEN_ADDR,
                    symbol: 'ECCYB',
                    decimals: 18,
                    image: 'https://projects.eccyb.org/app/logo.png', 
                },
            },
        });

        log(currentLang === 'ua' ? "BTTC та ECCYB налаштовано!" : "BTTC & ECCYB ready!");
    } catch (error) {
        console.error("Setup error:", error);
        log("Error: " + error.message);
    }
}

function showForgot(show) {
    const loginForm = document.getElementById('loginForm');
    const forgotForm = document.getElementById('forgotForm');
    const resetStep = document.getElementById('step2Reset');
    const btnForgot = document.getElementById('btnForgot');
    const btnReset = document.getElementById('btnReset');
    
    if (loginForm) loginForm.style.display = show ? 'none' : 'block';
    if (forgotForm) forgotForm.style.display = show ? 'block' : 'none';
    
    if (resetStep) resetStep.style.display = 'none';
    if (btnForgot) btnForgot.style.display = 'block';
    if (btnReset) btnReset.style.display = 'none';
    
    if (document.getElementById('resetEmail')) document.getElementById('resetEmail').value = '';
    if (document.getElementById('resetToken')) document.getElementById('resetToken').value = '';
    if (document.getElementById('newPass')) document.getElementById('newPass').value = '';
}

async function handleForgot() {
    const email = document.getElementById('resetEmail')?.value;
    if (!email) {
        alert("Введіть email");
        return;
    }
    
    try {
        const resp = await fetch(`${API_URL}?action=forgot_password`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email })
        });
        const res = await resp.json();
        
        if (res.status === "success") {
            alert(res.message || "Код надіслано на email");
            const resetStep = document.getElementById('step2Reset');
            const btnForgot = document.getElementById('btnForgot');
            const btnReset = document.getElementById('btnReset');
            
            if (resetStep) resetStep.style.display = 'block';
            if (btnForgot) btnForgot.style.display = 'none';
            if (btnReset) btnReset.style.display = 'block';
        } else {
            alert(res.message);
        }
    } catch (e) {
        console.error("Forgot error:", e);
        alert("Помилка зв'язку з сервером");
    }
}

async function handleReset() {
    const email = document.getElementById('resetEmail')?.value;
    const token = document.getElementById('resetToken')?.value;
    const new_password = document.getElementById('newPass')?.value;

    if (!email || !token || !new_password) {
        alert("Будь ласка, заповніть всі поля");
        return;
    }

    try {
        const resp = await fetch(`${API_URL}?action=reset_password`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                email: email, 
                token: token, 
                new_password: new_password 
            })
        });
        
        const res = await resp.json();
        
        if (res.status === "success") {
            alert(res.message);
            showForgot(false);
            if (document.getElementById('resetEmail')) document.getElementById('resetEmail').value = '';
            if (document.getElementById('resetToken')) document.getElementById('resetToken').value = '';
            if (document.getElementById('newPass')) document.getElementById('newPass').value = '';
        } else {
            alert(res.message);
        }
    } catch (e) {
        console.error("Reset error:", e);
        alert("Помилка зв'язку з сервером");
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    userAddress = null;
    showUI(false);
    log(i18n[currentLang]?.logOutMsg || "Session ended.");
    window.location.href = "index.html"; 
}

function log(msg) { 
    const c = document.getElementById('console'); 
    if (c) c.innerHTML = `> ${msg}<br>` + c.innerHTML; 
}

async function handleTx(txPromise) {
    try { 
        log(i18n[currentLang]?.wait || "Processing..."); 
        const tx = await txPromise; 
        await tx.wait(); 
        log(i18n[currentLang]?.ok || "Success!"); 
        await syncData(); 
    } catch (e) { 
        log("Error: " + (e.reason || e.message)); 
    }
}

window.onload = init;
