import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { AccountView } from "@/components/mc/account-view";
import { getOrganizationBySlug } from "@/lib/data";
import { roleLabel, ROLE_META, type OrgRole } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Membership = { role: string; slug: string; name: string };

export default async function ComptePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  let fullName = "";
  let email = "";
  let memberships: Membership[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      email = user.email ?? "";
      const [{ data: profile }, { data: rows }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("organization_members")
          .select("role, organizations(name, slug)")
          .eq("user_id", user.id)
          .eq("status", "actif"),
      ]);
      fullName = profile?.full_name ?? "";
      memberships = (rows ?? [])
        .map((r) => {
          const o = r.organizations as unknown as { name: string; slug: string } | null;
          return o ? { role: r.role as string, slug: o.slug, name: o.name } : null;
        })
        .filter((m): m is Membership => m !== null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Compte"
        title="Mon compte"
        sub="Vos informations personnelles, votre connexion et les lieux auxquels vous avez accès. Distinct des réglages du lieu."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AccountView orgSlug={organization.slug} fullName={fullName} email={email} />

        {/* Mes lieux & rôles */}
        <div className="mc-card h-fit p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="size-4 text-coral" />
            <h3 className="font-heading text-base font-bold text-foreground">Mes lieux &amp; rôles</h3>
          </div>
          {memberships.length === 0 ? (
            <p className="text-[12.5px] text-warmgray">Aucun lieu associé à votre compte.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {memberships.map((m) => {
                const meta = ROLE_META[m.role as OrgRole];
                const current = m.slug === organization.slug;
                return (
                  <li key={m.slug}>
                    <Link
                      href={`/dashboard/${m.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-3 transition hover:border-coral hover:bg-peach-pale"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-foreground">{m.name}</span>
                          {current && (
                            <span className="shrink-0 rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-coral-dark">
                              Actuel
                            </span>
                          )}
                        </div>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            meta?.color ?? "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {roleLabel(m.role as OrgRole)}
                        </span>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-warmgray transition group-hover:text-coral" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
