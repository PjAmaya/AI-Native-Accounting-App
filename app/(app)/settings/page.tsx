import { prisma } from "@/lib/db";
import { authorizationUrl } from "@/lib/google/auth";
import { SettingsForm, type ProfileValues } from "@/components/form/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ googleConnected?: string; googleError?: string }>;
}) {
  const { googleConnected, googleError } = await searchParams;
  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });

  const values: ProfileValues = {
    legalName: profile.legalName,
    tradeName: profile.tradeName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    province: profile.province ?? "",
    postalCode: profile.postalCode ?? "",
    country: profile.country,
    businessNumber: profile.businessNumber ?? "",
    hstRegisteredFrom: profile.hstRegisteredFrom
      ? profile.hstRegisteredFrom.toISOString().slice(0, 10)
      : "",
    paymentInstructions: profile.paymentInstructions ?? "",
    invoiceFooter: profile.invoiceFooter ?? "",
    capitalizationThreshold: profile.capitalizationThreshold.toString(),
  };

  return (
    <div>
      <p className="eyebrow">Configuration</p>
      <h1 className="page-title mt-1.5">Settings</h1>
      <p className="mt-2 text-[14px] text-muted">
        Business details, tax registration, and invoice content.
      </p>
      <div className="mt-7">
        <SettingsForm values={values} />
      </div>

      <div className="card mt-6 px-6 py-5">
        <p className="text-[15px] font-semibold tracking-tight">Google Drive & Gmail</p>
        <p className="mt-1 text-[13px] text-muted">
          Connects to Drive for document storage and Gmail for sending invoice emails as drafts.
        </p>

        {googleError ? (
          <p className="mt-3 text-[13px] text-negative">{googleError}</p>
        ) : null}

        {googleConnected ? (
          <p className="mt-3 text-[13px] text-positive font-medium">
            Connected successfully. The refresh token has been stored.
          </p>
        ) : null}

        {profile.googleRefreshToken ? (
          <p className="mt-3 text-[13px] text-muted">
            Connected. To reconnect with a different account, click below.
          </p>
        ) : null}

        <a
          href={authorizationUrl()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          {profile.googleRefreshToken ? "Reconnect Google" : "Connect Google"}
        </a>
      </div>
    </div>
  );
}
