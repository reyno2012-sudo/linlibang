(function configureNeighborTrust(root) {
  function savedContractAddress() {
    try {
      return root.localStorage?.getItem("neighbortrust_contract_address") || "";
    } catch {
      return "";
    }
  }

  root.NB_WEB3_CONFIG = Object.freeze({
    chainId: 10143,
    chainIdHex: "0x279f",
    chainName: "Monad Testnet",
    nativeCurrency: { name: "Testnet MON", symbol: "MON", decimals: 18 },
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    blockExplorerUrls: ["https://testnet.monadscan.com"],
    artifactUrl: "/contracts/artifacts/NeighborEscrow.json",
    contractAddress: savedContractAddress(),
  });
})(typeof window !== "undefined" ? window : globalThis);
