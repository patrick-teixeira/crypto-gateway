import { ethers } from "ethers";

const RPC_URL   = "https://ronin.drpc.org";
const TOKEN     = "0x0b7007c13325c48911f73a2dad5fa5dcbf808adc";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const wallets = [
  "0xdC61b81C27F3E5cD4d6B8CF5CF5c6BD3f938f2b2",
  "0x649f307809b4917d39Fe355FE9E1922260C07b98",
  "0xc9DEe21B9aD81b17d78759f2Cc97e31Cd38e4e33",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);

const erc20Iface = new ethers.Interface([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

const mc3 = new ethers.Contract(MULTICALL3, [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])",
], provider);

const calls = [
  {
    target:       TOKEN,
    allowFailure: false,
    callData:     erc20Iface.encodeFunctionData("decimals"),
  },
  {
    target:       TOKEN,
    allowFailure: false,
    callData:     erc20Iface.encodeFunctionData("symbol"),
  },
  ...wallets.map((addr) => ({
    target:       TOKEN,
    allowFailure: true,
    callData:     erc20Iface.encodeFunctionData("balanceOf", [addr]),
  })),
];

const results = await mc3.aggregate3(calls);
const decimals = erc20Iface.decodeFunctionResult("decimals", results[0].returnData)[0];
let balances = {}
results.slice(2).forEach((r, i) => {
  if (!r.success) {
    console.log(wallets[i], "erro ao buscar saldo");
    return;
  }
  const raw       = erc20Iface.decodeFunctionResult("balanceOf", r.returnData)[0];
  const formatted = ethers.formatUnits(raw, decimals);
  balances[wallets[i]] = parseFloat(formatted) 
});
