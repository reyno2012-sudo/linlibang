const fs = require("node:fs");
const path = require("node:path");
const solc = require("solc");

const root = path.resolve(__dirname, "..");
const contractPath = path.join(root, "contracts", "NeighborEscrow.sol");
const artifactPath = path.join(root, "contracts", "artifacts", "NeighborEscrow.json");

function resolveImport(importPath) {
  const absolutePath = importPath.startsWith("@")
    ? path.join(root, "node_modules", importPath)
    : path.join(path.dirname(contractPath), importPath);
  try {
    return { contents: fs.readFileSync(absolutePath, "utf8") };
  } catch (error) {
    return { error: `Unable to resolve ${importPath}: ${error.message}` };
  }
}

function compileNeighborEscrow() {
  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "contracts/NeighborEscrow.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
  const errors = (output.errors || []).filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length) throw new Error(errors.map((diagnostic) => diagnostic.formattedMessage).join("\n"));

  const contract = output.contracts["contracts/NeighborEscrow.sol"].NeighborEscrow;
  return {
    contractName: "NeighborEscrow",
    compilerVersion: solc.version(),
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
  };
}

function writeArtifact() {
  const artifact = compileNeighborEscrow();
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`Compiled ${artifact.contractName} with ${artifact.compilerVersion}`);
  return artifact;
}

if (require.main === module) writeArtifact();

module.exports = { compileNeighborEscrow, writeArtifact };
