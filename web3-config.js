(function configureNeighborTrust(root) {
  function savedContractAddress() {
    try {
      return root.localStorage?.getItem("neighbortrust_contract_address") || "0x999531e68550e708F5D460b581C18A737FEE2D1c";
    } catch {
      return "0x999531e68550e708F5D460b581C18A737FEE2D1c";
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
