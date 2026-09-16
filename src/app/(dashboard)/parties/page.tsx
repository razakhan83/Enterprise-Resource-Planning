import { db } from "@/db";
import { parties } from "@/db/schema";
import { formatCurrency } from "@/utils/format";
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

export const dynamic = "force-dynamic";

export default async function PartiesPage() {
  const partyList = await db.select().from(parties);

  return (
    <div className="flex flex-col h-full gap-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900">
                Party & Account Directory
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Registered customers, vendors, and internal system financial accounts.
              </CardDescription>
            </div>
            <Badge variant="neutral" className="font-mono text-xs">
              {partyList.length} Accounts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Account Name</TableHead>
                <TableHead className="w-32">Classification</TableHead>
                <TableHead className="w-48">System Identifier</TableHead>
                <TableHead className="w-36">Contact Phone</TableHead>
                <TableHead>Registered Address</TableHead>
                <TableHead className="w-40 text-right">Current Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partyList.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-xs text-zinc-900">{p.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.type === "CUSTOMER"
                          ? "default"
                          : p.type === "SUPPLIER"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px] font-medium"
                    >
                      {p.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">
                    {p.systemRole || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-600">
                    {p.phone || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-600 truncate max-w-sm">
                    {p.address || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-right font-semibold text-xs text-zinc-900">
                    {formatCurrency(p.currentBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
