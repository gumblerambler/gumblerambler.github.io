const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

const API_URL = "https://projects.eccyb.org/app/api.php";
// Додати в i18n
// en: linkForgot: "Forgot password?", resetTitle: "Reset Password"
// ua: linkForgot: "Забули пароль?", resetTitle: "Відновлення пароля"
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
        wait: "Обробка...", ok: "Успішно!", stakeTitle: "Депозит",  withdrawTitle: "Повернення",
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
        // Слухаємо зміну гаманця
        window.ethereum.on('accountsChanged', async (accounts) => {
            console.log("Accounts changed:", accounts);
            if (accounts.length > 0) {
                // Спроба відновити сесію з новим гаманцем
                const newAddress = accounts[0].toLowerCase();
                const userEmail = sessionStorage.getItem('userEmail');
                
                if (userEmail) {
                    // Була сесія — перевіряємо новий гаманець
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'login', address: newAddress })
                    });
                    const result = await response.json();
                    
                    if (result.status === "success" && result.data) {
                        // Гаманець правильний — оновлюємо сесію
                        await establishSession(newAddress);
                        showUI(true);
                        await syncData();
                    } else {
                        // Гаманець неправильний — виходимо
                        logout();
                    }
                } else {
                    // Немає сесії — просто оновлюємо інтерфейс
                    window.location.reload();
                }
            } else {
                logout();
            }
        });

        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });

        // При завантаженні — перевіряємо, чи є активна сесія
        const userEmail = sessionStorage.getItem('userEmail');
        const walletAddress = sessionStorage.getItem('walletAddress');
        
        if (userEmail && walletAddress) {
            // Спроба відновити сесію
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0 && accounts[0].toLowerCase() === walletAddress) {
                await establishSession(walletAddress);
                showUI(true);
                await syncData();
            } else {
                showUI(false);
            }
        } else {
            showUI(false);
        }
    }
}

// функція для обробки зміни гаманця
async function handleAccountChange(newAddress) {
    try {
        // Отримуємо дані користувача з БД за поточною email-сесією
        const email = sessionStorage.getItem('userEmail');
        if (!email) {
            logout();
            return;
        }
        
        // Перевіряємо, чи новий гаманець належить цьому користувачеві
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'login_email', 
                email: email, 
                password: sessionStorage.getItem('userPassword') || '' 
            })
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            const dbWalletAddr = result.data.wallet_address.toLowerCase();
            if (newAddress === dbWalletAddr) {
                // Гаманець збігається — оновлюємо сесію
                await establishSession(newAddress);
                showUI(true);
                await syncData();
            } else {
                alert(`Цей акаунт прив'язаний до іншого гаманця: ${dbWalletAddr.slice(0,6)}...${dbWalletAddr.slice(-4)}. Будь ласка, переключіться на правильний гаманець.`);
                logout();
            }
        } else {
            logout();
        }
    } catch (e) {
        console.error("Handle account change error:", e);
        logout();
    }
}

async function emailLogin() {
    const email = document.getElementById('logEmail').value.trim();
    const pass = document.getElementById('logPass').value.trim();

    if (!email || !pass) return;

    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const currentMetaMaskAddr = accounts[0]?.toLowerCase();

        if (!currentMetaMaskAddr) {
            alert("Please  MetaMask first");
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
                alert(`This account is linked to wallet: ${dbWalletAddr.slice(0, 6)}...${dbWalletAddr.slice(-4)}. Please switch your MetaMask account.`);
                return;
            }

            // Зберігаємо ВСЕ необхідне
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('userEmail', email);
            sessionStorage.setItem('userPassword', pass);
            sessionStorage.setItem('walletAddress', dbWalletAddr);  // <-- ДОДАНО
            
            await establishSession(dbWalletAddr);
            showUI(true);
            log("Welcome, " + email);
        } else {
            alert(result.message);
        }
    } catch (e) {
        console.error("Login error:", e);
    }
}

async function reWallet() {
    try {
        log("Reing wallet...");
        
        // 1. Запитуємо підключення гаманця
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        
        if (!accounts || accounts.length === 0) {
            alert("Немає підключеного гаманця");
            return;
        }
        
        const edAddress = accounts[0].toLowerCase();
        log("ed wallet: " + edAddress);
        
        // 2. Перевіряємо, чи є збережений email (ознака, що користувач колись входив)
        const userEmail = sessionStorage.getItem('userEmail');
        
        if (!userEmail) {
            // Немає збереженого email — значить користувач не входив, просто підключаємо гаманець
            await ();
            return;
        }
        
        // 3. Перевіряємо, чи підключений гаманець належить цьому користувачеві
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'login', 
                address: edAddress 
            })
        });
        
        const result = await response.json();
        
        if (result.status === "success" && result.data) {
            // Гаманець знайдено в БД — відновлюємо сесію
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('walletAddress', edAddress);
            
            await establishSession(edAddress);
            showUI(true);
            await syncData();
            log("Session restored successfully!");
        } else {
            alert(`Гаманець ${edAddress.slice(0,6)}...${edAddress.slice(-4)} не зареєстрований. Будь ласка, увійдіть з email.`);
            // Очищаємо сесію і пропонуємо увійти
            logout();
        }
        
    } catch (e) {
        console.error("Re error:", e);
        log("Re error: " + e.message);
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
    if (!userAddress) await ();

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
            log("MetaMask не знайдено! Встановіть розширення.");
            return;
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);

        if (!accounts || accounts.length === 0) {
            log("Немає підключеного гаманця. Будь ласка, підключіть MetaMask.");
            return;
        }
        
        const walletAddr = accounts[0]; // Отримуємо адресу гаманця
        log("Гаманець підключено: " + walletAddr);
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
            log("Реєстрація успішна! Тепер увійдіть під своїм логіном.");
            toggleAuth(false); // Повертаємо користувача на форму логіну
        } else {
            log("Помилка БД: Сервер відхилив реєстрацію (можливо, такий email вже існує).");
        }

    } catch (e) {
        console.error(e);
        log("Помилка: " + e.message);
        //alert("Дію скасовано або виникла помилка підключення до MetaMask.");
    }
}

async function connect() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        
        if (accounts && accounts.length > 0) {
            const address = accounts[0].toLowerCase();
            log("Wallet connected: " + address);
            
            // Перевіряємо, чи цей гаманець вже зареєстрований
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', address: address })
            });
            
            const result = await response.json();
            
            if (result.status === "success" && result.data) {
                // Гаманець зареєстрований — відновлюємо сесію
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('userEmail', result.data.email);
                sessionStorage.setItem('walletAddress', address);
                await establishSession(address);
                showUI(true);
                await syncData();
                log("Welcome back!");
            } else {
                // Гаманець не зареєстрований — пропонуємо реєстрацію
                alert("Wallet not registered. Please register first.");
                window.location.href = "index.html";
            }
        }
    } catch (e) {
        log("Connection rejected: " + e.message);
    }
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
        updateDBCapitalDirectly();
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

    async function updateDBCapitalDirectly() {
        if (!userAddress) return;
        try {
            // Ми використовуємо POST, щоб api.php точно побачив 'action' у $input
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
            if (document.getElementById('userName')) document.getElementById('userName').innerText = result.name;
            if (document.getElementById('userGroup')) document.getElementById('userGroup').innerText = result.group;
            if (document.getElementById('userAddress')) document.getElementById('userAddress').innerText = userAddress;
            if (el && result.status === "success") {
              
                const cleanCapital = parseFloat(result.capital).toFixed(2);
                el.innerText = cleanCapital + " ECCYB";
                name.innterText = result.name;
                group.innterText = result.group;
                log("User "+result.name+" from "+result.group+" with wallet "+userAddress);
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
    
            // Параметри мережі
            const bttcChainId = '0xc7'; // 199 у шістнадцятковій системі
            
            // Перевіряємо, чи ми вже в цій мережі
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            if (currentChainId !== bttcChainId) {
                try {
                    // Намагаємося просто переключитися (якщо мережа вже є)
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: bttcChainId }],
                    });
                } catch (switchError) {
                    // Якщо мережі немає (код помилки 4902), додаємо її
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
    
            // 2. Додаємо токен (викликається окремо, щоб гарантувати імпорт)
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
    
    // Скидаємо стан форми відновлення
    if (resetStep) resetStep.style.display = 'none';
    if (btnForgot) btnForgot.style.display = 'block';
    if (btnReset) btnReset.style.display = 'none';
    
    // Очищаємо поля
    if (document.getElementById('resetEmail')) document.getElementById('resetEmail').value = '';
    if (document.getElementById('resetToken')) document.getElementById('resetToken').value = '';
    if (document.getElementById('newPass')) document.getElementById('newPass').value = '';
}

async function handleForgot() {
    const email = document.getElementById('resetEmail').value;
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
            // Показуємо поля для вводу коду та нового пароля
            document.getElementById('step2Reset').style.display = 'block';
            document.getElementById('btnForgot').style.display = 'none';
            document.getElementById('btnReset').style.display = 'block';
        } else {
            alert(res.message);
        }
    } catch (e) {
        console.error("Forgot error:", e);
        alert("Помилка зв'язку з сервером");
    }
}

async function handleReset() {
    const email = document.getElementById('resetEmail').value;
    const token = document.getElementById('resetToken').value;
    const new_password = document.getElementById('newPass').value;

    // Перевірка на порожні поля
    if (!email || !token || !new_password) {
        alert("Будь ласка, заповніть всі поля");
        return;
    }

    console.log("Sending reset request:", { email, token, new_password });

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
        console.log("Reset response:", res);
        
        if (res.status === "success") {
            alert(res.message);
            // Повертаємося до форми логіну
            showForgot(false);
            // Очищаємо поля
            document.getElementById('resetEmail').value = '';
            document.getElementById('resetToken').value = '';
            document.getElementById('newPass').value = '';
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
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('userPassword');
    sessionStorage.removeItem('walletAddress');  // <-- ДОДАНО
    
    userAddress = null;
    signer = null;
    tokenContract = null;
    stakingContract = null;
    
    showUI(false);
    log(i18n[currentLang].logOutMsg);
    window.location.href = "index.html";
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
