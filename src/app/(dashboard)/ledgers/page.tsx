import { db } from "@/db";
import { ledgerTransactions, parties } from "@/db/schema";
import { formatCurrency, formatDate } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function LedgersPage() {
  const transactions = await db
    .select({
      id: ledgerTransactions.id,
      partyName: parties.name,
      partyType: parties.type,
      systemRole: parties.systemRole,
      type: ledgerTransactions.type,
      referenceId: ledgerTransactions.referenceId,
      debit: ledgerTransactions.debit,
      credit: ledgerTransactions.credit,
      particulars: ledgerTransactions.particulars,
      createdAt: ledgerTransactions.createdAt,
    })
    .from(ledgerTransactions)
    .innerJoin(parties, eq(ledgerTransactions.partyId, parties.id))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col h-full gap-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900">
                Financial Audit Trail & General Ledger
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Immutable double-entry journal postings with zero delete policy.
              </CardDescription>
            </div>
            <Badge variant="neutral" className="font-mono text-xs">
              {transactions.length} Transactions
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Posting Timestamp</TableHead>
                <TableHead className="w-64">Account / Party</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead>Particulars / Memo</TableHead>
                <TableHead className="w-36 text-right">Debit</TableHead>
                <TableHead className="w-36 text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-zinc-400 text-xs">
                    No transactions recorded in the financial ledger yet.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-zinc-900">
                      <div>{tx.partyName}</div>
                      {tx.systemRole && (
                        <div className="text-[10px] text-zinc-400 font-mono">{tx.systemRole}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600">{tx.particulars}</TableCell>
                    <TableCell className="font-mono text-right text-xs font-semibold text-zinc-900">
                      {Number(tx.debit) > 0 ? formatCurrency(tx.debit) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-right text-xs font-semibold text-zinc-900">
                      {Number(tx.credit) > 0 ? formatCurrency(tx.credit) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
