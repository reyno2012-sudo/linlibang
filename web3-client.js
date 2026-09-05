(function exposeNeighborWeb3(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NeighborWeb3 = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createNeighborWeb3Api() {
  const statusLabels = ["等待接单", "已接单", "待验收", "资金已释放", "已取消", "争议冻结"];
  const finalityLabels = {
    submitted: "交易已提交",
    safe: "已安全确认",
    finalized: "已最终确认",
  };

  function shortAddress(address) {
    if (!address) return "未连接";
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  function statusLabel(status) {
    return statusLabels[Number(status)] || "未知状态";
  }

  function finalityLabel(state) {
    return finalityLabels[state] || "等待确认";
  }

  function taskDigestInput(task = {}) {
    return {
      title: String(task.title || "邻里互助"),
      time: String(task.time || "待协商"),
      place: String(task.place || task.location || "小区公共区域"),
      budget: Number(task.budget || 0),
    };
  }

  function addGasBuffer(estimate) {
    const gas = BigInt(estimate);
    return gas + gas / 10n;
  }

  function normalizeWalletError(error = {}) {
    const message = `${error.shortMessage || error.message || ""}`.toLowerCase();
    if (error.code === 4001 || error.code === "ACTION_REJECTED") return "你取消了钱包签名，任务草稿已保留。";
    if (error.code === 4902) return "钱包中还没有 Monad Testnet，请先添加网络。";
    if (message.includes("insufficient funds") || message.includes("exceeds balance")) return "测试币余额不足，请先领取 Test MON。";
    if (message.includes("wrong network") || message.includes("chain")) return "当前网络不是 Monad Testnet，请切换网络后重试。";
    if (message.includes("contract not deployed")) return "托管合约尚未部署，请先完成 Monad 测试网部署。";
    return "链上操作暂时失败，请稍后重试。";
  }

  function createClient({ ethereum, ethers, config, artifact, onProgress = () => {} }) {
    if (!ethereum) throw new Error("Wallet not installed");
    if (!ethers) throw new Error("Ethers unavailable");
    if (!config || !artifact) throw new Error("Web3 configuration unavailable");

    const provider = new ethers.BrowserProvider(ethereum);

    async function switchNetwork() {
      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainIdHex }] });
      } catch (error) {
        if (error.code !== 4902) throw error;
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: config.chainIdHex,
            chainName: config.chainName,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: config.rpcUrls,
            blockExplorerUrls: config.blockExplorerUrls,
          }],
        });
      }
    }

    async function ensureNetwork() {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== Number(config.chainId)) {
        await switchNetwork();
      }
    }

    async function connect() {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      await ensureNetwork();
      const account = ethers.getAddress(accounts[0]);
      const balance = await provider.getBalance(account, "safe");
      return { account, balance, balanceFormatted: ethers.formatEther(balance) };
    }

    function configuredAddress() {
      if (!config.contractAddress || !ethers.isAddress(config.contractAddress)) throw new Error("Contract not deployed");
      return config.contractAddress;
    }

    async function contractWithSigner() {
      await ensureNetwork();
      const signer = await provider.getSigner();
      return new ethers.Contract(configuredAddress(), artifact.abi, signer);
    }

    function readContract() {
      return new ethers.Contract(configuredAddress(), artifact.abi, provider);
    }

    async function waitForFinality(receipt) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const finalizedBlock = await provider.getBlock("finalized");
          if (finalizedBlock && finalizedBlock.number >= receipt.blockNumber) return "finalized";
        } catch {
          return "safe";
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return "safe";
    }

    async function write(method, args, overrides) {
      const contract = await contractWithSigner();
      const estimateArgs = overrides ? [...args, overrides] : args;
      const estimate = await contract[method].estimateGas(...estimateArgs);
      const transactionOverrides = { ...(overrides || {}), gasLimit: addGasBuffer(estimate) };
      const tx = await contract[method](...args, transactionOverrides);
      onProgress("submitted", tx.hash);
      const receipt = await tx.wait();
      onProgress("safe", tx.hash);
      const finality = await waitForFinality(receipt);
      onProgress(finality, tx.hash);
      return { hash: tx.hash, receipt, finality };
    }

    async function createTask(task, amount = "0.01") {
      const payload = taskDigestInput(task);
      const taskId = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
      const result = await write("createTask", [taskId], { value: ethers.parseEther(amount) });
      return { ...result, taskId, payload };
    }

    async function readTask(taskId) {
      const task = await readContract().tasks(taskId, { blockTag: "safe" });
      return {
        taskId,
        requester: task.requester,
        helper: task.helper,
        amount: task.amount,
        amountFormatted: ethers.formatEther(task.amount),
        status: Number(task.status),
        statusText: statusLabel(task.status),
        createdAt: Number(task.createdAt),
        completedAt: Number(task.completedAt),
      };
    }

    async function completedCount(address) {
      return Number(await readContract().completedTasks(address, { blockTag: "safe" }));
    }

    return {
      acceptTask: (taskId) => write("acceptTask", [taskId]),
      approveAndRelease: (taskId) => write("approveAndRelease", [taskId]),
      cancelTask: (taskId) => write("cancelTask", [taskId]),
      completedCount,
      connect,
      createTask,
      markCompleted: (taskId) => write("markCompleted", [taskId]),
      raiseDispute: (taskId) => write("raiseDispute", [taskId]),
      readTask,
      switchNetwork,
      transactionUrl: (hash) => `${config.blockExplorerUrls[0]}/tx/${hash}`,
    };
  }

  return {
    addGasBuffer,
    createClient,
    finalityLabel,
    normalizeWalletError,
    shortAddress,
    statusLabel,
    taskDigestInput,
  };
});
