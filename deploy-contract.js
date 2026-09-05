const deployButton = document.querySelector("#deploy");
const statusLine = document.querySelector("#status");

function setDeploymentStatus(message) {
  statusLine.textContent = message;
}

async function ensureMonadTestnet() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: window.NB_WEB3_CONFIG.chainIdHex }],
    });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: window.NB_WEB3_CONFIG.chainIdHex,
        chainName: window.NB_WEB3_CONFIG.chainName,
        nativeCurrency: window.NB_WEB3_CONFIG.nativeCurrency,
        rpcUrls: window.NB_WEB3_CONFIG.rpcUrls,
        blockExplorerUrls: window.NB_WEB3_CONFIG.blockExplorerUrls,
      }],
    });
  }
}

async function deployNeighborEscrow() {
  if (!window.ethereum) throw new Error("请先安装 MetaMask 或其他 EVM 浏览器钱包。");
  deployButton.disabled = true;
  await window.ethereum.request({ method: "eth_requestAccounts" });
  await ensureMonadTestnet();

  setDeploymentStatus("正在读取合约并等待钱包签名…");
  const artifactResponse = await fetch(window.NB_WEB3_CONFIG.artifactUrl);
  if (!artifactResponse.ok) throw new Error("无法读取合约构建产物。");
  const artifact = await artifactResponse.json();
  const provider = new window.ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const factory = new window.ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  const transaction = contract.deploymentTransaction();
  setDeploymentStatus(`部署交易已提交：${transaction.hash}`);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const code = await provider.getCode(address);
  if (!code || code === "0x") throw new Error("未在链上检测到合约字节码，请重试。");
  localStorage.setItem("neighbortrust_contract_address", address);
  setDeploymentStatus(`部署并校验成功：${address}。现在可以返回移动端体验。`);
}

deployButton.addEventListener("click", async () => {
  try {
    await deployNeighborEscrow();
  } catch (error) {
    setDeploymentStatus(error.code === 4001 ? "你取消了钱包签名，可以稍后再试。" : error.message || "部署失败，请稍后重试。");
  } finally {
    deployButton.disabled = false;
  }
});
