import { prisma } from "@/lib/db";
import { SettingsForm, type ProfileValues } from "@/components/form/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
    </div>
  );
}
