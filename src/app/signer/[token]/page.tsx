import { notFound } from "next/navigation";
import { getDocumentBySigningToken } from "@/lib/data";
import { SignerClient } from "./signer-client";

export const dynamic = "force-dynamic";

export default async function SignerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getDocumentBySigningToken(token);
  if (!doc) notFound();

  return <SignerClient doc={doc} token={token} />;
}
