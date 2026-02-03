const TOKEN_ADDR = "0x4aa97493d7c8e570a548549222d21e91aa6c60ca";
const STAKING_ADDR = "0x440C907485cb68B3A708EcC3d0E93d121bF6dAeb";
const OWNER_ADDR = "0xf08b28c6d8a26cd1a24d1dbc95c89005f1e04ead";

let signer, tokenContract, stakingContract, userAddress;

async function init() {
    if (!window.ethereum) return alert("Please install MetaMask");
    
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

    // Show admin link if owner
    const isAdmin = userAddress.toLowerCase() === OWNER_ADDR.toLowerCase();
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'inline' : 'none');

    await syncData();
    log("Session initialized for " + userAddress.substring(0, 10));
}

async function syncData() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
        const bal = await tokenContract.balanceOf(userAddress);
        if (document.getElementById('userBalance')) 
            document.getElementById('userBalance').innerText = `${Math.floor(ethers.formatUnits(bal, 18))} ECCYB`;

        const gas = await provider.getBalance(userAddress);
        if (document.getElementById('gasBalance')) 
            document.getElementById('gasBalance').innerText = parseFloat(ethers.formatEther(gas)).toFixed(2);

        const net = await provider.getNetwork();
        if (document.getElementById('netStatus'))
            document.getElementById('netStatus').innerText = net.chainId === 199n ? "BTTC Mainnet" : "Wrong Network";
    } catch (e) { console.error(e); }
}

async function handleTx(txPromise) {
    try {
        log("Processing transaction...");
        const tx = await txPromise;
        log("Waiting confirmation: " + tx.hash.substring(0, 15) + "...");
        await tx.wait();
        log("Transaction confirmed!");
        await syncData();
    } catch (e) { 
        log("Error: " + (e.reason || e.message));
    }
}

function log(msg) {
    const c = document.getElementById('console');
    if (c) {
        c.innerHTML = `> ${msg}<br>` + c.innerHTML;
        c.scrollTop = 0;
    }
}

window.onload = init;
