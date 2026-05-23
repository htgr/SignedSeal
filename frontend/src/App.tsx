import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { arcTestnet } from "./wagmi";
import { parseEther, formatEther } from "viem";
import { shortAddr, formatDistanceToNow } from "./utils";

const ADDR = (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`) || "0x0000000000000000000000000000000000000000";
const ABI = [
  { name: "create", type: "function", stateMutability: "payable", inputs: [{ name: "party2", type: "address" }, { name: "title", type: "string" }, { name: "details", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "sign", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "cancel", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "getAll", type: "function", stateMutability: "view", inputs: [{ name: "count", type: "uint256" }], outputs: [{ type: "tuple[]", components: [{ name: "id", type: "uint256" }, { name: "party1", type: "address" }, { name: "party2", type: "address" }, { name: "title", type: "string" }, { name: "details", type: "string" }, { name: "amount", type: "uint256" }, { name: "party1Signed", type: "bool" }, { name: "party2Signed", type: "bool" }, { name: "state", type: "uint8" }, { name: "createdAt", type: "uint256" }, { name: "signedAt", type: "uint256" }] }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const AC = "#059669";
const STATE_LABELS = ["Pending", "Signed", "Cancelled"];
const STATE_COLORS = ["#f59e0b", "#22c55e", "#64748b"];

type WriteContractFn = ReturnType<typeof useWriteContract>["writeContract"];

function ReceiptCard({ r, address, AC: color, isLoading, writeContract: wc }: {
  r: any; address: string; AC: string; isLoading: boolean; writeContract: WriteContractFn;
}) {
  const isParty1 = address?.toLowerCase() === r.party1?.toLowerCase();
  const isParty2 = address?.toLowerCase() === r.party2?.toLowerCase();
  return (
    <div className="bg-slate-900/60 border border-white/8 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-white font-bold text-sm">{r.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: STATE_COLORS[r.state] + "25", color: STATE_COLORS[r.state] }}>{STATE_LABELS[r.state]}</span>
          <span className="text-slate-500 text-xs">#{r.id.toString()}</span>
        </div>
      </div>
      {r.details && <p className="text-slate-400 text-xs mb-2 line-clamp-2">{r.details}</p>}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
        <span>{shortAddr(r.party1)} {r.party1Signed ? "✅" : "⏳"}</span>
        <span>→</span>
        <span>{shortAddr(r.party2)} {r.party2Signed ? "✅" : "⏳"}</span>
        {r.amount > 0n && <span className="ml-auto font-bold" style={{ color }}>{parseFloat(formatEther(r.amount)).toFixed(2)} USDC locked</span>}
      </div>
      <p className="text-slate-700 text-xs">{formatDistanceToNow(Number(r.createdAt))}{r.state === 1 && r.signedAt > 0n ? ` · Sealed ${formatDistanceToNow(Number(r.signedAt))}` : ""}</p>
      {r.state === 0 && (
        <div className="flex gap-2 mt-2">
          {isParty2 && !r.party2Signed && (
            <button onClick={() => wc({ address: ADDR, abi: ABI, functionName: "sign", args: [r.id] })} disabled={isLoading} className="flex-1 text-xs py-2 rounded-lg font-bold text-white disabled:opacity-50" style={{ background: color }}>✍️ Sign & Seal</button>
          )}
          {isParty1 && (
            <button onClick={() => wc({ address: ADDR, abi: ABI, functionName: "cancel", args: [r.id] })} disabled={isLoading} className="text-xs px-3 py-2 rounded-lg text-slate-500 hover:text-red-400 border border-slate-700 disabled:opacity-50 transition-all">Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { isConnected, address } = useAccount();
  const [tab, setTab] = useState<"browse" | "create">("browse");
  const [party2, setParty2] = useState(""); const [title, setTitle] = useState(""); const [details, setDetails] = useState(""); const [lockAmount, setLockAmount] = useState("0");
  const [done, setDone] = useState(false);

  const { data: receipts, refetch } = useReadContract({ address: ADDR, abi: ABI, functionName: "getAll", args: [BigInt(20)], query: { refetchInterval: 8000 } });
  const { data: total } = useReadContract({ address: ADDR, abi: ABI, functionName: "total" });
  const { data: hash, isPending, writeContract, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess && !done) { setDone(true); refetch(); setParty2(""); setTitle(""); setDetails(""); setLockAmount("0"); setTimeout(() => setDone(false), 3000); }
  const isLoading = isPending || isConfirming;

  const list = (receipts as any[]) ?? [];
  const lockBig = (() => { try { return parseEther(lockAmount); } catch { return 0n; } })();

  const myReceipts = isConnected && address
    ? list.filter((r: any) => r.party1?.toLowerCase() === address.toLowerCase() || r.party2?.toLowerCase() === address.toLowerCase())
    : [];
  const otherReceipts = isConnected && address
    ? list.filter((r: any) => r.party1?.toLowerCase() !== address.toLowerCase() && r.party2?.toLowerCase() !== address.toLowerCase())
    : list;

  return (
    <div className="min-h-screen bg-[#080b14]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 z-50 bg-[#080b14]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤝</span>
          <span className="font-bold text-white text-lg">Signed<span style={{ color: AC }}>Seal</span></span>
          <span className="hidden sm:block text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700">Arc Testnet</span>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
      </header>
      <main className="relative z-10 max-w-xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🤝</div>
          <h1 className="text-4xl font-black text-white mb-3">Signed<span style={{ color: AC }}>Seal</span></h1>
          <p className="text-slate-400 text-sm">Two-party on-chain receipts. Both parties sign to permanently seal the agreement.</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-slate-800/60 px-4 py-2 rounded-full border border-slate-700 text-slate-400 text-sm">{total?.toString() ?? "0"} receipts created</div>
        </div>

        <div className="flex bg-slate-900/60 rounded-xl p-1 mb-5 border border-white/8">
          {(["browse", "create"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "text-white" : "text-slate-400 hover:text-white"}`} style={tab === t ? { background: AC } : {}}>
              {t === "browse" ? "🤝 Browse Receipts" : "✚ Create Receipt"}
            </button>
          ))}
        </div>

        {tab === "create" && (
          !isConnected ? <div className="text-center py-8 text-slate-500">Connect wallet to create a receipt</div> : (
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 mb-5">
              <h2 className="font-bold text-white mb-4">Create a Receipt 🤝</h2>
              <input value={party2} onChange={e => setParty2(e.target.value)} placeholder="Counter-party 0x… address *" className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none font-mono mb-2" />
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Agreement title *" className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-2" />
              <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Agreement details, terms, or description…" rows={3} className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none mb-3" />
              <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-1">Lock USDC (optional — released to counter-party on signing)</label>
                <input type="number" value={lockAmount} onChange={e => setLockAmount(e.target.value)} step="0.1" min="0" className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
              </div>
              {done ? <div className="py-3 text-center rounded-xl font-bold text-sm" style={{ background: `${AC}20`, color: AC }}>🤝 Receipt created! Share the ID with your counter-party.</div>
                : <button onClick={() => writeContract({ address: ADDR, abi: ABI, functionName: "create", args: [party2 as `0x${string}`, title, details], value: lockBig })} disabled={isLoading || party2.length !== 42 || !title} className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: AC }}>{isLoading ? (isPending ? "Confirm..." : "Creating...") : `🤝 Create${lockBig > 0n ? ` & Lock ${lockAmount} USDC` : ""}`}</button>}
              {error && <p className="mt-2 text-red-400 text-xs text-center">{error.message?.includes("User rejected") ? "Cancelled" : error.message?.slice(0, 80)}</p>}
            </div>
          )
        )}

        {tab === "browse" && (
          <div className="space-y-3">
            {isConnected && myReceipts.length > 0 && (
              <>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Your Receipts ({myReceipts.length})</h3>
                {myReceipts.map((r: any, i: number) => (
                  <ReceiptCard key={i} r={r} address={address!} AC={AC} isLoading={isLoading} writeContract={writeContract} />
                ))}
                {otherReceipts.length > 0 && <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-4">Recent Receipts</h3>}
              </>
            )}
            {(isConnected ? otherReceipts : list).map((r: any, i: number) => (
              <ReceiptCard key={i} r={r} address={address ?? ""} AC={AC} isLoading={isLoading} writeContract={writeContract} />
            ))}
            {list.length === 0 && <div className="text-center py-10 text-slate-500">No receipts yet — create the first one!</div>}
          </div>
        )}
        <footer className="mt-10 text-center text-xs text-slate-600"><p>SignedSeal · <a href={`https://testnet.arcscan.app/address/${ADDR}`} target="_blank" rel="noreferrer" className="hover:text-slate-400">{ADDR.slice(0,6)}...{ADDR.slice(-4)}</a> · Chain {arcTestnet.id}</p></footer>
      </main>
    </div>
  );
}
