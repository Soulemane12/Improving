import { redirect } from "next/navigation";

const DEFAULT_LIGHTDASH_DASHBOARD_URL =
  "https://app.lightdash.cloud/projects/1c850f67-cc15-4216-ab82-8be7d9b99876/home";

export default function DashboardPage() {
  const lightdashUrl =
    process.env.NEXT_PUBLIC_LIGHTDASH_DASHBOARD_URL ||
    process.env.LIGHTDASH_DASHBOARD_URL ||
    DEFAULT_LIGHTDASH_DASHBOARD_URL;

  redirect(lightdashUrl);
}
